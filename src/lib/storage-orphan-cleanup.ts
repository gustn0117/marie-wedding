import 'server-only';

import { createServiceClient } from '@/lib/supabase/service';

export const STORAGE_CLEANUP_BUCKETS = [
  'avatars',
  'job-images',
  'event-images',
  'banners',
  'portfolios',
  'resume-files',
] as const;

type CleanupBucket = (typeof STORAGE_CLEANUP_BUCKETS)[number];
type ReferenceMap = Record<CleanupBucket, Set<string>>;

const DB_PAGE_SIZE = 500;
const STORAGE_PAGE_SIZE = 100;
const MAX_ROWS_PER_TABLE = 100_000;
const MAX_OBJECTS_PER_BUCKET = 100_000;
const REMOVE_BATCH_SIZE = 20;

interface StorageObjectInfo {
  bucket: CleanupBucket;
  path: string;
  createdAt: string;
  size: number;
}

export interface StorageCleanupOptions {
  /** 기본 7일. 업로드 직후 저장 응답 유실/장기 작성 중인 폼을 보존한다. */
  minAgeHours?: number;
  /** 한 실행의 최대 삭제 수. 다음 주기에서 이어서 처리한다. */
  maxDeletes?: number;
  /** true면 Storage remove를 호출하지 않는다. */
  dryRun?: boolean;
  signal?: AbortSignal;
}

export interface StorageCleanupResult {
  dryRun: boolean;
  minAgeHours: number;
  scannedObjects: number;
  referencedObjects: number;
  eligibleOrphans: number;
  selectedForRemoval: number;
  removed: number;
  failed: number;
  reclaimedBytes: number;
  candidates: Array<Pick<StorageObjectInfo, 'bucket' | 'path' | 'createdAt' | 'size'>>;
  errors: string[];
}

function emptyReferenceMap(): ReferenceMap {
  return Object.fromEntries(
    STORAGE_CLEANUP_BUCKETS.map((bucket) => [bucket, new Set<string>()]),
  ) as ReferenceMap;
}

function decodePathSegment(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function normalizeObjectPath(value: string): string | null {
  const path = value
    .trim()
    .replace(/^\/+/, '')
    .split('/')
    .map(decodePathSegment)
    .join('/');
  if (!path || path.includes('\\') || path.split('/').some((part) => !part || part === '.' || part === '..')) {
    return null;
  }
  return path;
}

/** HTML/URL 어디에 있든 Supabase public/signed Storage 경로를 수집한다. */
function addEmbeddedReferences(references: ReferenceMap, value: string): boolean {
  const pattern = /\/storage\/v1\/(?:object|render\/image)\/(?:public|sign|authenticated)\/([a-zA-Z0-9._-]+)\/([^?#[\]"'<>\s]+)/gi;
  let found = false;
  for (const match of value.matchAll(pattern)) {
    const bucket = match[1] as CleanupBucket;
    if (!Object.prototype.hasOwnProperty.call(references, bucket)) continue;
    const path = normalizeObjectPath(match[2]);
    if (!path) continue;
    references[bucket].add(path);
    found = true;
  }
  return found;
}

function addKnownBucketPath(
  references: ReferenceMap,
  bucket: CleanupBucket,
  value: unknown,
): void {
  if (typeof value !== 'string' || !value.trim()) return;
  if (addEmbeddedReferences(references, value)) return;
  // 외부 URL을 해당 버킷의 object key로 오인하지 않는다.
  if (/^(?:https?:|data:|blob:)/i.test(value.trim())) return;
  const path = normalizeObjectPath(value);
  if (path) references[bucket].add(path);
}

function addHtmlReferences(references: ReferenceMap, value: unknown): void {
  if (typeof value === 'string' && value) addEmbeddedReferences(references, value);
}

/** resumes.attachments(jsonb)[].path 를 resume-files 참조로 등록한다. */
function addAttachmentReferences(references: ReferenceMap, value: unknown): void {
  if (!Array.isArray(value)) return;
  for (const item of value) {
    if (item && typeof item === 'object' && typeof (item as Record<string, unknown>).path === 'string') {
      addKnownBucketPath(references, 'resume-files', (item as Record<string, unknown>).path);
    }
  }
}

async function readAllRows(
  table: string,
  columns: string,
  signal?: AbortSignal,
  idColumn = 'id',
): Promise<Array<Record<string, unknown>>> {
  const client = createServiceClient(signal);
  const rows: Array<Record<string, unknown>> = [];
  let lastId: string | null = null;

  for (let readCount = 0; readCount < MAX_ROWS_PER_TABLE; readCount += DB_PAGE_SIZE) {
    if (signal?.aborted) throw signal.reason ?? new DOMException('정리 작업이 취소되었습니다.', 'AbortError');
    let query = client
      .from(table)
      .select(`${idColumn}, ${columns}`)
      .order(idColumn, { ascending: true })
      .limit(DB_PAGE_SIZE);
    if (lastId) query = query.gt(idColumn, lastId);
    const { data, error } = await query.abortSignal(signal ?? new AbortController().signal);
    if (error) {
      throw new Error(`Storage 참조 조회 실패 (${table}): ${error.message}`);
    }
    // table/columns는 아래 고정 호출부에서만 들어오지만 SDK의 문자열 parser는 동적
    // select를 GenericStringError로 추론하므로 런타임 행 shape로 한 번 좁힌다.
    const page = (data ?? []) as unknown as Array<Record<string, unknown>>;
    rows.push(...page);
    if (page.length < DB_PAGE_SIZE) return rows;
    const nextLastId = page[page.length - 1]?.[idColumn];
    if (typeof nextLastId !== 'string' || nextLastId === lastId) {
      throw new Error(`Storage 참조 페이지 진행에 실패했습니다 (${table}).`);
    }
    lastId = nextLastId;
  }

  throw new Error(`Storage 참조 조회 상한을 초과했습니다 (${table}, ${MAX_ROWS_PER_TABLE}행).`);
}

/**
 * soft-delete 행도 복원될 수 있으므로 제외하지 않는다. 모든 쿼리가 성공해야만 결과를
 * 반환하며 하나라도 실패하면 삭제 단계로 진행하지 않는 fail-closed 수집기다.
 */
async function collectStorageReferences(signal?: AbortSignal): Promise<ReferenceMap> {
  const references = emptyReferenceMap();
  const [profiles, jobs, posts, events, banners, portfolios, resumes, resumeSnapshots] = await Promise.all([
    readAllRows('profiles', 'profile_image, cover_image, gallery, bio', signal),
    readAllRows('jobs', 'image, description', signal),
    readAllRows('posts', 'content', signal),
    readAllRows('events', 'image, content', signal),
    readAllRows('banners', 'image_path_pc, image_path_mobile', signal),
    readAllRows('portfolios', 'images, cover_image, description', signal),
    readAllRows('resumes', 'photo_path, attachments', signal),
    readAllRows('application_resume_snapshots', 'photo_path, snapshot', signal, 'application_id'),
  ]);

  for (const row of profiles) {
    addKnownBucketPath(references, 'avatars', row.profile_image);
    addKnownBucketPath(references, 'avatars', row.cover_image);
    if (Array.isArray(row.gallery)) {
      row.gallery.forEach((path) => addKnownBucketPath(references, 'avatars', path));
    }
    addHtmlReferences(references, row.bio);
  }
  for (const row of jobs) {
    addKnownBucketPath(references, 'job-images', row.image);
    addHtmlReferences(references, row.description);
  }
  posts.forEach((row) => addHtmlReferences(references, row.content));
  for (const row of events) {
    addKnownBucketPath(references, 'event-images', row.image);
    addHtmlReferences(references, row.content);
  }
  for (const row of banners) {
    addKnownBucketPath(references, 'banners', row.image_path_pc);
    addKnownBucketPath(references, 'banners', row.image_path_mobile);
  }
  for (const row of portfolios) {
    if (Array.isArray(row.images)) {
      row.images.forEach((path) => addKnownBucketPath(references, 'portfolios', path));
    }
    addKnownBucketPath(references, 'portfolios', row.cover_image);
    addHtmlReferences(references, row.description);
  }
  for (const row of resumes) {
    addKnownBucketPath(references, 'resume-files', row.photo_path);
    // 포트폴리오 PDF 첨부. 경로가 attachments(jsonb)[].path 안에만 있어, 여기서
    // 참조로 등록하지 않으면 살아있는 이력서의 첨부가 고아로 오인돼 영구삭제된다.
    addAttachmentReferences(references, row.attachments);
  }
  for (const row of resumeSnapshots) {
    addKnownBucketPath(references, 'resume-files', row.photo_path);
    // 제출 스냅샷에도 첨부 경로가 복제되므로 함께 보호한다.
    if (row.snapshot && typeof row.snapshot === 'object' && !Array.isArray(row.snapshot)) {
      const snap = row.snapshot as Record<string, unknown>;
      addKnownBucketPath(references, 'resume-files', typeof snap.photoPath === 'string' ? snap.photoPath : null);
      addAttachmentReferences(references, snap.attachments);
    }
  }
  return references;
}

async function listBucketObjects(
  bucket: CleanupBucket,
  signal?: AbortSignal,
): Promise<StorageObjectInfo[]> {
  const client = createServiceClient(signal);
  const directories = [''];
  const objects: StorageObjectInfo[] = [];

  while (directories.length > 0) {
    const directory = directories.shift()!;
    if (directory.split('/').length > 12) {
      throw new Error(`Storage 폴더 깊이가 비정상적입니다 (${bucket}/${directory}).`);
    }

    for (let offset = 0; ; offset += STORAGE_PAGE_SIZE) {
      if (signal?.aborted) throw signal.reason ?? new DOMException('정리 작업이 취소되었습니다.', 'AbortError');
      const { data, error } = await client.storage.from(bucket).list(directory, {
        limit: STORAGE_PAGE_SIZE,
        offset,
        sortBy: { column: 'name', order: 'asc' },
      });
      if (error) throw new Error(`Storage 목록 조회 실패 (${bucket}/${directory}): ${error.message}`);

      const page = data ?? [];
      for (const entry of page) {
        const path = directory ? `${directory}/${entry.name}` : entry.name;
        // Supabase Storage list에서 폴더는 id/metadata/created_at이 모두 null이다.
        if (!entry.id && !entry.metadata && !entry.created_at) {
          directories.push(path);
          continue;
        }
        if (!entry.created_at) continue; // 생성 시각이 불명확한 객체는 절대 자동 삭제하지 않는다.
        objects.push({
          bucket,
          path,
          createdAt: entry.created_at,
          size: typeof entry.metadata?.size === 'number' ? entry.metadata.size : 0,
        });
        if (objects.length > MAX_OBJECTS_PER_BUCKET) {
          throw new Error(`Storage 객체 조회 상한을 초과했습니다 (${bucket}, ${MAX_OBJECTS_PER_BUCKET}개).`);
        }
      }
      if (page.length < STORAGE_PAGE_SIZE) break;
    }
  }

  return objects;
}

function isReferenced(references: ReferenceMap, object: StorageObjectInfo): boolean {
  return references[object.bucket].has(object.path);
}

function clampInteger(value: number | undefined, fallback: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return fallback;
  return Math.min(max, Math.max(min, Math.floor(value!)));
}

/**
 * DB metadata를 직접 지우지 않고 Supabase Storage list/remove API만 사용한다.
 * 실행 모드에서는 목록 조회 후 DB 참조를 한 번 더 수집해, 스캔 도중 저장된 파일이
 * 삭제 후보에 남는 창을 최대한 줄인다.
 */
export async function cleanupStorageOrphans(
  options: StorageCleanupOptions = {},
): Promise<StorageCleanupResult> {
  const minAgeHours = clampInteger(options.minAgeHours, 7 * 24, 24, 365 * 24);
  const maxDeletes = clampInteger(options.maxDeletes, 100, 1, 500);
  const dryRun = options.dryRun ?? true;
  const cutoff = Date.now() - minAgeHours * 60 * 60 * 1000;

  const initialReferences = await collectStorageReferences(options.signal);
  const bucketObjects = await Promise.all(
    STORAGE_CLEANUP_BUCKETS.map((bucket) => listBucketObjects(bucket, options.signal)),
  );
  const allObjects = bucketObjects.flat();
  const initialCandidates = allObjects
    .filter((object) => {
      const createdAt = Date.parse(object.createdAt);
      return Number.isFinite(createdAt)
        && createdAt <= cutoff
        && !isReferenced(initialReferences, object);
    })
    .sort((left, right) => Date.parse(left.createdAt) - Date.parse(right.createdAt));

  // 실행 직전에 전체 참조를 다시 읽는다. 첫 조회 뒤 commit된 경로는 여기서 탈락한다.
  const finalReferences = dryRun
    ? initialReferences
    : await collectStorageReferences(options.signal);
  const finalCandidates = initialCandidates.filter((object) => !isReferenced(finalReferences, object));
  const selected = finalCandidates.slice(0, maxDeletes);
  const errors: string[] = [];
  let removed = 0;
  let reclaimedBytes = 0;

  if (!dryRun) {
    for (const bucket of STORAGE_CLEANUP_BUCKETS) {
      const bucketCandidates = selected.filter((object) => object.bucket === bucket);
      for (let offset = 0; offset < bucketCandidates.length; offset += REMOVE_BATCH_SIZE) {
        const batch = bucketCandidates.slice(offset, offset + REMOVE_BATCH_SIZE);
        if (options.signal?.aborted) {
          throw options.signal.reason ?? new DOMException('정리 작업이 취소되었습니다.', 'AbortError');
        }
        // 중요: storage.objects를 DELETE하지 않는다. Storage 서비스가 파일과 metadata를
        // 함께 일관되게 처리하도록 공식 remove API를 호출한다.
        const { error } = await createServiceClient(options.signal)
          .storage
          .from(bucket)
          .remove(batch.map((object) => object.path));
        if (error) {
          errors.push(`${bucket}: ${error.message}`);
          continue;
        }
        removed += batch.length;
        reclaimedBytes += batch.reduce((sum, object) => sum + object.size, 0);
      }
    }
  }

  return {
    dryRun,
    minAgeHours,
    scannedObjects: allObjects.length,
    referencedObjects: Object.values(finalReferences).reduce((sum, paths) => sum + paths.size, 0),
    eligibleOrphans: finalCandidates.length,
    selectedForRemoval: selected.length,
    removed,
    failed: dryRun ? 0 : selected.length - removed,
    reclaimedBytes,
    // 관리자 응답/로그가 무한히 커지지 않게 실제 처리 대상(최대 500개)만 노출한다.
    candidates: selected.map(({ bucket, path, createdAt, size }) => ({ bucket, path, createdAt, size })),
    errors,
  };
}
