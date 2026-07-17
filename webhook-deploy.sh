#!/usr/bin/env bash
#
# 마리에 무중단 배포 (blue/green).
# 설계: docs/superpowers/specs/2026-07-17-zero-downtime-deploy-design.md
#
# auto-deployer(webhook.py)가 이 파일이 있으면 `docker compose up -d --build`
# 대신 이걸 실행한다. 수동 배포도 반드시 이 스크립트를 쓸 것 — compose 를 직접
# 돌리면 훅 배포와 레이스가 나서 컨테이너 이름 충돌이 재발한다.
#
# 흐름: 대기 색 빌드 → 기동 → 헬스 대기 → nginx upstream 스왑 → 드레인 → 옛 색 정리
# 어느 단계든 실패하면 스왑하지 않고 빠져나온다. 그동안 활성 색은 계속 서비스한다.

set -euo pipefail

cd "$(dirname "$0")"

UPSTREAM_FILE="nginx/upstream.inc"
HEALTH_TIMEOUT=90     # 새 색이 healthy 될 때까지 최대 대기(초)
DRAIN_SECONDS=8       # 스왑 후 옛 색이 처리중 요청을 마칠 시간

log() { echo "[deploy] $*"; }
fail() { echo "[deploy][FAIL] $*" >&2; exit 1; }

# 호스트 공개 포트 — compose 가 .env 의 PORT 를 보간하므로 여기서도 같은 값을 읽는다.
PORT="${PORT:-$(grep -E '^PORT=' .env 2>/dev/null | head -1 | cut -d= -f2 | tr -d '\r[:space:]')}"
PORT="${PORT:-3000}"

# 활성 색의 판단 근거는 "nginx 가 실제로 보고 있는 파일". 상태를 따로 저장하면
# 실제와 어긋날 수 있다.
if grep -q 'web-green' "$UPSTREAM_FILE" 2>/dev/null; then
  ACTIVE=green; IDLE=blue
else
  ACTIVE=blue;  IDLE=green
fi
log "active=$ACTIVE → deploying to idle=$IDLE (port $PORT)"

# 1) 대기 색 빌드 — 실패해도 활성 색은 무사하다.
log "building web-$IDLE ..."
docker compose --profile "$IDLE" build "web-$IDLE" || fail "build failed; active ($ACTIVE) still serving"

# 2) 대기 색 기동 (항상 새 이미지로 새로 만든다)
log "starting web-$IDLE ..."
docker compose --profile "$IDLE" up -d --force-recreate "web-$IDLE" \
  || fail "could not start web-$IDLE; active ($ACTIVE) still serving"

IDLE_CID="$(docker compose --profile "$IDLE" ps -q "web-$IDLE")"
[ -n "$IDLE_CID" ] || fail "web-$IDLE container not found"

# 3) 헬스 대기 — compose healthcheck 가 /api/health 를 두드린다.
log "waiting for web-$IDLE to become healthy ..."
deadline=$(( SECONDS + HEALTH_TIMEOUT ))
while :; do
  status="$(docker inspect --format '{{.State.Health.Status}}' "$IDLE_CID" 2>/dev/null || echo missing)"
  [ "$status" = healthy ] && break
  if [ "$status" = missing ]; then
    docker compose --profile "$IDLE" rm -sf "web-$IDLE" >/dev/null 2>&1 || true
    fail "web-$IDLE disappeared while starting; active ($ACTIVE) still serving"
  fi
  if [ "$SECONDS" -ge "$deadline" ]; then
    log "web-$IDLE last logs:"; docker logs --tail 30 "$IDLE_CID" 2>&1 | sed 's/^/    /' || true
    docker compose --profile "$IDLE" rm -sf "web-$IDLE" >/dev/null 2>&1 || true
    fail "web-$IDLE not healthy in ${HEALTH_TIMEOUT}s; NOT swapping. active ($ACTIVE) still serving"
  fi
  sleep 2
done
log "web-$IDLE is healthy"

# 4) upstream 스왑. 되돌릴 수 있게 원본을 백업해 둔다.
cp "$UPSTREAM_FILE" "$UPSTREAM_FILE.bak" 2>/dev/null || true
cat > "$UPSTREAM_FILE" <<EOF
# 활성 색(blue/green)을 가리키는 유일한 지점.
# webhook-deploy.sh 가 이 파일을 통째로 다시 쓰고 nginx -s reload 로 반영한다.
# 손으로 고치지 말 것 — 다음 배포 때 덮어써진다.
set \$upstream_target http://web-$IDLE:3000;
EOF

revert_upstream() {
  if [ -f "$UPSTREAM_FILE.bak" ]; then
    mv "$UPSTREAM_FILE.bak" "$UPSTREAM_FILE"
    docker compose exec -T nginx nginx -s reload >/dev/null 2>&1 || true
  fi
}
cleanup_idle() {
  docker compose --profile "$IDLE" rm -sf "web-$IDLE" >/dev/null 2>&1 || true
}

# 5) 설정 검증을 "되돌릴 수 없는 단계보다 먼저" 한다.
#    아래 6)에서 레거시 컨테이너를 지워 포트를 비우는데, 그 뒤에 설정 오류를
#    발견하면 nginx 도 못 뜨고 옛 컨테이너도 없어 복구 불가로 사이트가 죽는다.
#    일회용 컨테이너로 문법을 먼저 확인한다.
log "validating nginx config ..."
if ! docker run --rm -v "$PWD/nginx:/etc/nginx/conf.d:ro" nginx:1.27-alpine nginx -t >/dev/null 2>&1; then
  docker run --rm -v "$PWD/nginx:/etc/nginx/conf.d:ro" nginx:1.27-alpine nginx -t 2>&1 | sed 's/^/    /' || true
  revert_upstream
  cleanup_idle
  fail "nginx config invalid; nothing touched. active ($ACTIVE) still serving"
fi

# 6) 최초 전환 대비: 옛 단일 컨테이너(marie-wedding-web-1)가 3046 을 잡고 있으면
#    nginx 가 뜰 수 없다. 이때만 짧은 다운타임이 생기고, 이후 배포부터는 없다.
if docker ps --format '{{.Names}}' | grep -qx 'marie-wedding-web-1'; then
  log "legacy single container detected — removing to free port $PORT (one-time downtime)"
  docker rm -f marie-wedding-web-1 >/dev/null 2>&1 || true
fi

# nginx 가 아직 없으면(최초 전환) 띄운다. 이미 있으면 재생성하지 않는다 —
# 3046 을 물고 있는 컨테이너를 건드리는 순간 무중단이 아니게 된다.
log "ensuring nginx is up ..."
docker compose up -d nginx || { revert_upstream; fail "nginx could not start"; }

log "reloading nginx → web-$IDLE"
docker compose exec -T nginx nginx -s reload || { revert_upstream; fail "nginx reload failed"; }

# 6) 진짜 공개 포트로 확인. 여기까지 200 이어야 스왑이 성공한 것이다.
for i in $(seq 1 10); do
  code="$(curl -s -o /dev/null -w '%{http_code}' --max-time 5 "http://127.0.0.1:${PORT}/api/health" || echo 000)"
  [ "$code" = 200 ] && break
  if [ "$i" -eq 10 ]; then
    revert_upstream
    fail "port $PORT not serving after swap (last=$code); rolled back to $ACTIVE"
  fi
  sleep 1
done
log "port $PORT serving from web-$IDLE"
rm -f "$UPSTREAM_FILE.bak"

# 7) 드레인 후 옛 색 정리. nginx 는 이미 새 색만 보내고 있으므로 여기서
#    옛 색이 죽어도 사용자 요청은 영향받지 않는다.
log "draining old color for ${DRAIN_SECONDS}s ..."
sleep "$DRAIN_SECONDS"
if [ -n "$(docker compose --profile "$ACTIVE" ps -q "web-$ACTIVE" 2>/dev/null)" ]; then
  log "stopping web-$ACTIVE"
  docker compose --profile "$ACTIVE" rm -sf "web-$ACTIVE" >/dev/null 2>&1 || true
fi

log "done. now serving from web-$IDLE"
