#!/usr/bin/env bash
#
# 마리에 무중단 배포 (blue/green).
# 설계: docs/superpowers/specs/2026-07-17-zero-downtime-deploy-design.md
#
# auto-deployer(webhook.py)가 이 파일이 있으면 `docker compose up -d --build`
# 대신 이걸 실행한다. 수동 배포도 반드시 이 스크립트를 쓸 것 — compose 를 직접
# 돌리면 훅 배포와 레이스가 나서 컨테이너 이름 충돌이 재발한다.
#
# 흐름: 대기 색 빌드 → 기동 → 헬스 대기 → 설정검증 → nginx upstream 스왑 → 드레인 → 옛 색 정리
# 파괴적 단계 전에 전부 검증하고, 실패하면 스왑하지 않고 빠져나온다.

set -euo pipefail

cd "$(dirname "$0")"

UPSTREAM_FILE="nginx/upstream.inc"
HEALTH_TIMEOUT=90     # 새 색이 healthy 될 때까지 최대 대기(초)
DRAIN_SECONDS=8       # 스왑 후 옛 색이 처리중 요청을 마칠 시간

log() { echo "[deploy] $*"; }
fail() { echo "[deploy][FAIL] $*" >&2; exit 1; }

# 호스트 공개 포트. .env 를 권위값으로 삼아 반드시 export 한다.
#
# 훅(webhook.py)은 컨테이너 안에서 nsenter 로 이 스크립트를 부르는데, 그때
# 넘어오는 환경에 PORT 가 이미 들어있으면 compose 는 .env 보다 환경변수를
# 우선한다. 실제로 그것 때문에 nginx 가 포트를 하나도 안 열고 떠서 사이트가
# 내려간 적이 있다. 여기서 명시적으로 덮어써 호출자에 상관없이 같게 만든다.
PORT="$(grep -E '^PORT=' .env 2>/dev/null | head -1 | cut -d= -f2 | tr -d '[:space:]')"
PORT="${PORT:-3000}"
export PORT

running_color() {
  if [ -n "$(docker compose --profile green ps -q web-green 2>/dev/null)" ]; then echo green; return; fi
  if [ -n "$(docker compose --profile blue  ps -q web-blue  2>/dev/null)" ]; then echo blue;  return; fi
  echo ""
}

# 활성 색 판단: upstream 파일이 1순위(= nginx 가 실제로 보고 있는 값),
# 없거나 깨졌으면 실행중인 컨테이너로 판단한다.
#
# upstream.inc 는 git 추적 대상이 아니다(.gitignore). 추적되면 훅의 git pull 이
# 이 파일을 리포 기본값으로 되돌려, 실제로는 green 이 서비스 중인데 스크립트가
# "활성=blue" 로 오판하고 살아있는 green 을 재생성해 죽인다.
ACTIVE=""
if [ -f "$UPSTREAM_FILE" ]; then
  if   grep -q 'web-green' "$UPSTREAM_FILE"; then ACTIVE=green
  elif grep -q 'web-blue'  "$UPSTREAM_FILE"; then ACTIVE=blue
  fi
fi
[ -z "$ACTIVE" ] && ACTIVE="$(running_color)"
[ -z "$ACTIVE" ] && ACTIVE=blue

if [ "$ACTIVE" = blue ]; then IDLE=green; else IDLE=blue; fi

# 옛 색이 실제로 떠 있는지 — 롤백 가능 여부를 좌우한다. 부트스트랩(최초 전환)
# 때는 옛 색이 없으므로, 실패해도 "없는 색으로 되돌리기" 를 하면 안 된다.
ACTIVE_RUNNING=0
[ -n "$(docker compose --profile "$ACTIVE" ps -q "web-$ACTIVE" 2>/dev/null)" ] && ACTIVE_RUNNING=1

log "active=$ACTIVE (running=$ACTIVE_RUNNING) → deploying to idle=$IDLE (port $PORT)"

# 1) 대기 색 빌드 — 실패해도 활성 색은 무사하다.
log "building web-$IDLE ..."
docker compose --profile "$IDLE" build "web-$IDLE" || fail "build failed; active ($ACTIVE) still serving"

# 2) 대기 색 기동 (항상 새 이미지로 새로 만든다)
log "starting web-$IDLE ..."
docker compose --profile "$IDLE" up -d --force-recreate "web-$IDLE" \
  || fail "could not start web-$IDLE; active ($ACTIVE) still serving"

IDLE_CID="$(docker compose --profile "$IDLE" ps -q "web-$IDLE")"
[ -n "$IDLE_CID" ] || fail "web-$IDLE container not found"

cleanup_idle() { docker compose --profile "$IDLE" rm -sf "web-$IDLE" >/dev/null 2>&1 || true; }

# 3) 헬스 대기 — compose healthcheck 가 /api/health 를 두드린다.
log "waiting for web-$IDLE to become healthy ..."
deadline=$(( SECONDS + HEALTH_TIMEOUT ))
while :; do
  status="$(docker inspect --format '{{.State.Health.Status}}' "$IDLE_CID" 2>/dev/null || echo missing)"
  [ "$status" = healthy ] && break
  if [ "$status" = missing ]; then
    cleanup_idle
    fail "web-$IDLE disappeared while starting; active ($ACTIVE) still serving"
  fi
  if [ "$SECONDS" -ge "$deadline" ]; then
    log "web-$IDLE last logs:"; docker logs --tail 30 "$IDLE_CID" 2>&1 | sed 's/^/    /' || true
    cleanup_idle
    fail "web-$IDLE not healthy in ${HEALTH_TIMEOUT}s; NOT swapping. active ($ACTIVE) still serving"
  fi
  sleep 2
done
log "web-$IDLE is healthy"

# 4) upstream 스왑 준비. 되돌릴 수 있게 원본을 백업해 둔다.
cp "$UPSTREAM_FILE" "$UPSTREAM_FILE.bak" 2>/dev/null || true
cat > "$UPSTREAM_FILE" <<EOF
# 배포 스크립트가 생성한다. 손으로 고치지 말 것.
# 활성 색: $IDLE
set \$upstream_target http://web-$IDLE:3000;
EOF

revert_upstream() {
  # 되돌릴 옛 색이 실제로 없으면 되돌리면 안 된다. 없는 색을 가리키면 nginx 가
  # DNS 해석에 실패해 사이트 전체가 502 가 된다(실제로 겪음).
  if [ "$ACTIVE_RUNNING" = 1 ] && [ -f "$UPSTREAM_FILE.bak" ]; then
    mv "$UPSTREAM_FILE.bak" "$UPSTREAM_FILE"
    docker compose exec -T nginx nginx -s reload >/dev/null 2>&1 || true
    log "rolled upstream back to web-$ACTIVE"
  else
    rm -f "$UPSTREAM_FILE.bak"
    log "no running previous color to roll back to; leaving upstream at web-$IDLE"
  fi
}

# 5) 설정 검증을 "되돌릴 수 없는 단계보다 먼저" 한다.
#    아래에서 레거시 컨테이너를 지워 포트를 비우는데, 그 뒤에 설정 오류를
#    발견하면 nginx 도 못 뜨고 옛 컨테이너도 없어 복구 불가로 사이트가 죽는다.
log "validating nginx config ..."
if ! docker run --rm -v "$PWD/nginx:/etc/nginx/conf.d:ro" nginx:1.27-alpine nginx -t >/dev/null 2>&1; then
  docker run --rm -v "$PWD/nginx:/etc/nginx/conf.d:ro" nginx:1.27-alpine nginx -t 2>&1 | sed 's/^/    /' || true
  revert_upstream
  cleanup_idle
  fail "nginx config invalid; nothing touched. active ($ACTIVE) still serving"
fi

# 6) 최초 전환 대비: 옛 단일 컨테이너(marie-wedding-web-1)가 포트를 잡고 있으면
#    nginx 가 뜰 수 없다. 이때만 짧은 다운타임이 생기고, 이후 배포부터는 없다.
if docker ps --format '{{.Names}}' | grep -qx 'marie-wedding-web-1'; then
  log "legacy single container detected — removing to free port $PORT (one-time downtime)"
  docker rm -f marie-wedding-web-1 >/dev/null 2>&1 || true
fi

# 7) nginx 보장. 이미 올바르게 떠 있으면 절대 재생성하지 않는다 —
#    포트를 물고 있는 컨테이너를 건드리는 순간 무중단이 아니게 된다.
#    단, 포트가 틀리게 떠 있으면(과거 훅이 환경변수 때문에 포트 없이 만든 사례)
#    고쳐야 하므로 그때만 재생성한다.
NGINX_CID="$(docker compose ps -q nginx 2>/dev/null || true)"
if [ -z "$NGINX_CID" ]; then
  log "starting nginx ..."
  docker compose up -d nginx || { revert_upstream; fail "nginx could not start"; }
else
  BOUND="$(docker port "$NGINX_CID" 80/tcp 2>/dev/null | head -1 || true)"
  if [ "$BOUND" != "127.0.0.1:${PORT}" ]; then
    log "nginx port mismatch (got '${BOUND:-none}', want 127.0.0.1:${PORT}) — recreating"
    docker compose up -d --force-recreate nginx || { revert_upstream; fail "nginx could not start"; }
  fi
fi

# 8) 설정 재검증(실행중 컨테이너 기준) 후 리로드.
if ! docker compose exec -T nginx nginx -t >/dev/null 2>&1; then
  docker compose exec -T nginx nginx -t 2>&1 | sed 's/^/    /' || true
  revert_upstream
  cleanup_idle
  fail "nginx config invalid in running container; active ($ACTIVE) still serving"
fi

log "reloading nginx → web-$IDLE"
docker compose exec -T nginx nginx -s reload || { revert_upstream; fail "nginx reload failed"; }

# 9) 진짜 공개 포트로 확인. 여기까지 200 이어야 스왑이 성공한 것이다.
for i in $(seq 1 10); do
  code="$(curl -s -o /dev/null -w '%{http_code}' --max-time 5 "http://127.0.0.1:${PORT}/api/health" 2>/dev/null || true)"
  [ "$code" = 200 ] && break
  if [ "$i" -eq 10 ]; then
    revert_upstream
    fail "port $PORT not serving after swap (last=${code:-none})"
  fi
  sleep 1
done
log "port $PORT serving from web-$IDLE"
rm -f "$UPSTREAM_FILE.bak"

# 10) 드레인 후 옛 색 정리. nginx 는 이미 새 색만 보내고 있으므로 여기서
#     옛 색이 죽어도 사용자 요청은 영향받지 않는다.
if [ "$ACTIVE_RUNNING" = 1 ]; then
  log "draining web-$ACTIVE for ${DRAIN_SECONDS}s ..."
  sleep "$DRAIN_SECONDS"
  docker compose --profile "$ACTIVE" rm -sf "web-$ACTIVE" >/dev/null 2>&1 || true
fi

log "done. now serving from web-$IDLE"
