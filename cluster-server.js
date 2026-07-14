// 멀티코어 활용 — Next.js standalone(server.js)을 여러 워커로 실행해
// SSR 부하를 CPU 코어에 분산한다. 단일 프로세스 대비 처리량 ~N배.
// (1,000+ 동시접속 대비. 공유 서버라 기본 워커 수는 보수적으로 제한, WEB_CONCURRENCY 로 override)
const cluster = require('cluster');
const os = require('os');
const { createHmac } = require('crypto');

const cpuCount = os.cpus().length || 1;

// 워커 수 결정: WEB_CONCURRENCY 우선, 없으면 min(코어수-1, 4). 항상 1 이상, 코어수 이하.
let desired;
const envN = parseInt(process.env.WEB_CONCURRENCY || '', 10);
if (Number.isFinite(envN) && envN > 0) {
  desired = envN;
} else {
  desired = Math.min(Math.max(1, cpuCount - 1), 4);
}
const workers = Math.max(1, Math.min(desired, cpuCount));

// isPrimary: Node 16+ (Node 18 이미지 OK). 폴백으로 isMaster 도 확인.
const isPrimary = cluster.isPrimary !== undefined ? cluster.isPrimary : cluster.isMaster;

// 업로드 성공 뒤 저장 실패/화면 이탈로 남은 Storage 객체는 DB 참조 전체를 대조한
// Next 내부 endpoint가 정리한다. primary 한 곳에서만 호출해 멀티 워커 중복 실행을
// 피하고, 실패는 로그만 남겨 웹 서비스/worker 수명과 완전히 분리한다.
function scheduleStorageOrphanCleanup() {
  if (process.env.STORAGE_CLEANUP_SCHEDULED === '0') return;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceRoleKey) {
    console.warn('[storage-cleanup] disabled: server credential is not configured');
    return;
  }

  const token = createHmac('sha256', serviceRoleKey)
    .update('marie-storage-orphan-cleanup-v1')
    .digest('hex');
  const port = Number.parseInt(process.env.PORT || '3000', 10) || 3000;
  const initialDelayMs = Math.max(
    60_000,
    Number.parseInt(process.env.STORAGE_CLEANUP_INITIAL_DELAY_MS || '', 10) || 10 * 60_000,
  );
  const intervalMs = Math.max(
    60 * 60_000,
    Number.parseInt(process.env.STORAGE_CLEANUP_INTERVAL_MS || '', 10) || 24 * 60 * 60_000,
  );
  let running = false;

  const run = async () => {
    if (running) return;
    running = true;
    try {
      const response = await fetch(`http://127.0.0.1:${port}/api/admin/storage-cleanup`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        // 최소 7일 유예 + 회당 100개 상한. endpoint도 같은 값을 다시 clamp한다.
        body: JSON.stringify({ dryRun: false, minAgeHours: 168, maxDeletes: 100 }),
        signal: AbortSignal.timeout(65_000),
      });
      if (!response.ok) {
        // 응답 body에는 후보 path가 들어갈 수 있으므로 상태 코드만 기록한다.
        console.warn(`[storage-cleanup] request failed (HTTP ${response.status})`);
        return;
      }
      const result = await response.json();
      console.log('[storage-cleanup] complete', {
        scanned: Number(result.scannedObjects) || 0,
        eligible: Number(result.eligibleOrphans) || 0,
        removed: Number(result.removed) || 0,
        failed: Number(result.failed) || 0,
        reclaimedBytes: Number(result.reclaimedBytes) || 0,
      });
    } catch (error) {
      // URL, token, 응답 body, object path는 로그에 남기지 않는다.
      const reason = error && typeof error === 'object' && error.name === 'TimeoutError'
        ? 'timeout'
        : 'unavailable';
      console.warn(`[storage-cleanup] ${reason}; will retry on the next schedule`);
    } finally {
      running = false;
    }
  };

  const firstTimer = setTimeout(() => {
    void run();
    const recurringTimer = setInterval(() => void run(), intervalMs);
    recurringTimer.unref();
  }, initialDelayMs);
  firstTimer.unref();
}

if (isPrimary && workers > 1) {
  console.log(`[cluster] primary ${process.pid}: forking ${workers} workers of ${cpuCount} CPUs`);
  for (let i = 0; i < workers; i++) cluster.fork();
  cluster.on('exit', (worker, code, signal) => {
    console.error(`[cluster] worker ${worker.process.pid} exited (${signal || code}); restarting`);
    cluster.fork();
  });
  scheduleStorageOrphanCleanup();
} else {
  // 워커 프로세스(또는 workers===1) — 실제 Next 서버 구동
  require('./server.js');
  // 단일 프로세스 모드에서는 이 프로세스가 scheduler도 한 번만 맡는다.
  if (isPrimary) scheduleStorageOrphanCleanup();
}
