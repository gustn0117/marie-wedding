// 멀티코어 활용 — Next.js standalone(server.js)을 여러 워커로 실행해
// SSR 부하를 CPU 코어에 분산한다. 단일 프로세스 대비 처리량 ~N배.
// (1,000+ 동시접속 대비. 공유 서버라 기본 워커 수는 보수적으로 제한, WEB_CONCURRENCY 로 override)
const cluster = require('cluster');
const os = require('os');

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

if (isPrimary && workers > 1) {
  console.log(`[cluster] primary ${process.pid}: forking ${workers} workers of ${cpuCount} CPUs`);
  for (let i = 0; i < workers; i++) cluster.fork();
  cluster.on('exit', (worker, code, signal) => {
    console.error(`[cluster] worker ${worker.process.pid} exited (${signal || code}); restarting`);
    cluster.fork();
  });
} else {
  // 워커 프로세스(또는 workers===1) — 실제 Next 서버 구동
  require('./server.js');
}
