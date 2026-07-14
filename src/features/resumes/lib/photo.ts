const RESUME_PHOTO_PATH_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\/resume\/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.(?:jpg|png|webp)$/i;

export function isCanonicalResumePhotoPath(path: string, ownerUserId?: string): boolean {
  if (!RESUME_PHOTO_PATH_PATTERN.test(path) || path.includes('%') || path.includes('\\')) return false;
  return !ownerUserId || path.startsWith(`${ownerUserId}/resume/`);
}

export function resolveResumePhotoUrl(path: string | null | undefined): string | null {
  if (!path || !isCanonicalResumePhotoPath(path)) return null;
  return `/api/resumes/photo?path=${encodeURIComponent(path)}`;
}
