# 마리에 무중단 배포 설계

작성일: 2026-07-17

## 목표

배포 중에도 요청이 끊기지 않게 한다. 배포 실패 시 사이트가 죽지 않고 이전 버전이 계속 서비스한다.

## 현재 구조 (조사 결과)

| 항목 | 현황 |
|---|---|
| 진입점 | cloudflared(**137개 앱 공유**, `/home/server/.cloudflared/config.yml` 662줄) → `localhost:3046`. `marie.co.kr`, `www.marie.co.kr`, `marie-wedding.hsweb.pics` 3개 호스트 |
| 배포 실행 | GitHub push → `auto-deployer/webhook.py`(**137개 앱 공유**) → `git pull` + `docker compose up -d --build` |
| 포트 주입 | `/home/server/apps/marie-wedding/.env` 의 `PORT=3046` 을 compose 가 자동 보간 |
| 앱 실행 | 단일 컨테이너 `marie-wedding-web-1`, `node cluster-server.js` (워커 4) |
| 자원 | 23GB 중 13GB 여유, 8코어. 앱 1벌 = 356MB |

### 현재 문제

1. **다운타임**: compose recreate 는 컨테이너를 죽이고 새로 만든다 → Next 부팅까지 15~20초 먹통.
2. **실패 시 사이트 사망**: 새 컨테이너가 잘못 떠도 옛 컨테이너는 이미 사라진 뒤다.
3. **컨테이너 이름 충돌 반복**: 훅의 배포와 수동 ssh 배포가 **동시에 같은 컨테이너를 recreate** 하는 레이스. 배포 때마다 재현됨.
4. **헬스체크 부재**: `/api/health` 없음(404) → 새 버전이 실제로 응답 가능한지 알 방법이 없음.

## 결정한 방식: nginx 프록시 + blue/green

3046 을 **nginx 가 계속 점유**하고, 앱은 호스트 포트 없이 내부망에 blue/green 두 벌로 뜬다.

```
cloudflared → 127.0.0.1:3046 → [nginx] → web-blue:3000   (활성)
                                       ↘ web-green:3000  (대기/신규)
```

배포 절차:
1. 새 이미지 빌드
2. **대기 색** 기동
3. 헬스체크 통과까지 폴링 (실패 시 **스왑 안 하고 종료** → 옛 색이 계속 서비스)
4. upstream 파일 교체 + `nginx -s reload` (graceful: 처리중 요청 유지)
5. 드레인 대기 후 옛 색 정지

3046 을 물고 있는 nginx 는 배포 중 재생성되지 않으므로 **이름 충돌 문제도 함께 해소**된다.

### 대안과 기각 사유

- **Docker Swarm 롤링 업데이트**: `order: start-first` 로 간단하지만, 평범한 compose 앱 137개가 도는 호스트를 swarm 모드로 전환해야 함. 네트워킹·secrets·env_file 의미가 모두 바뀜. 위험 대비 이득 없음.
- **포트 스왑 + cloudflared 리로드**: cloudflared 가 137개 앱 공유라 리로드가 전부에 영향. 662줄 설정을 배포 스크립트가 기계적으로 고치는 것도 위험.

## 공유 인프라 영향 범위

**다른 136개 앱의 동작은 바뀌지 않는다.** 단 `webhook.py` 파일 자체는 공유라 수정한다.

```python
# 추가되는 분기 (하위호환)
if os.path.isfile(f'{APPS_DIR}/{repo_name}/webhook-deploy.sh'):
    cmd = ... 'bash webhook-deploy.sh'
else:
    cmd = ... 'docker compose up -d --build'   # 기존과 동일
```

### 트랩: 파일명을 `deploy.sh` 로 하면 안 됨

`cebu-cij-academy` 에 **이미 `deploy.sh` 가 존재**한다(내용도 "Zero-downtime deploy script"). 현재 훅은 그걸 실행하지 않는다. `deploy.sh` 를 기준으로 분기하면 **요청하지도 않은 cebu 앱의 배포 방식이 갑자기 바뀐다**.

→ 마리에만 가질 고유 파일명 **`webhook-deploy.sh`** 를 사용한다. 다른 136개 앱은 이 파일이 없으므로 실행 경로가 지금과 100% 동일하다.

## nginx 설정 — 기존 `nginx.conf` 는 재활용하지 않는다

레포의 `nginx.conf`(108줄)는 연결된 적 없는 미사용 파일이며, 그대로 쓰면 다음 회귀가 발생한다.

1. **IP 기반 제한 붕괴 (심각)**
   `unlock/route.ts:61` 은 IP 를 `x-real-ip` → `cf-connecting-ip` → `x-forwarded-for` 순으로 읽는다. 현재는 `x-real-ip` 가 없어 `cf-connecting-ip`(진짜 IP)를 쓴다.
   기존 conf 의 `proxy_set_header X-Real-IP $remote_addr` 는 컨테이너 nginx 에서 **도커 게이트웨이 IP(전 사용자 동일)** 가 된다. `set_real_ip_from 127.0.0.1` 도 peer 가 게이트웨이라 매칭되지 않는다.
   → 관리자 unlock·가입 IP 제한이 **전역 공용**이 되어 한 명의 실패가 전체를 차단.

2. **업로드 413 (심각)**
   `client_max_body_size 10M` 인데 이력서 PDF 첨부가 10MB + 멀티파트 오버헤드다. 현재는 nginx 가 없어 이런 제한 자체가 없다. → 그대로 두면 최대 크기 PDF 가 413.

3. **관리자 rate limit 3r/m**: 요청받지 않은 동작 변경. 방금 관리자 비번 마찰을 없앤 방침과도 충돌.

### 방침: 동작을 하나도 바꾸지 않는 최소 프록시

- `X-Real-IP` 를 **설정하지 않는다** → 앱은 지금처럼 `cf-connecting-ip` 를 읽는다(현행 동작 보존)
- `CF-Connecting-IP`, `X-Forwarded-For` 는 cloudflared 가 보낸 값 그대로 통과
- `client_max_body_size 20M` (앱 라우트가 자체 상한을 이미 강제하므로 nginx 는 넉넉히)
- `proxy_read_timeout 120s` (첨부 업로드 라우트 타임아웃 60s 를 넘지 않도록)
- 캐시·보안헤더·rate limit 등 부가 기능 없음 — 순수 전송 스왑

미사용 `nginx.conf` 는 혼동 방지를 위해 삭제하고 `nginx/` 디렉토리로 대체한다.

## 헬스체크

`/api/health` 신설. **얕은 체크**로 한다 — Supabase 까지 검사하면 DB 가 잠시 느릴 때 배포가 실패한다.

- 200 `{"ok":true}` 반환, 인증 불필요(`/api/*` 는 미들웨어 공개 경로)
- compose `healthcheck` 로 등록하고, 배포 스크립트는 `docker inspect` 의 health 상태를 폴링
- 이미지가 `node:22-alpine` 이므로 별도 도구 없이 node 로 체크

## graceful 종료

`cluster-server.js` 에 SIGTERM 처리가 **없다**. 게다가 `cluster.on('exit')` 가 워커를 자동 재시작해 종료를 방해할 수 있다.

- SIGTERM 수신 시 `shuttingDown` 플래그 → 워커 재시작 중단 → 워커에 SIGTERM 전파 → 종료
- 크래시 시 재시작하는 기존 동작은 유지(종료 중일 때만 재시작 안 함)
- 배포 스크립트의 드레인 대기(스왑 후 일정 시간)가 1차 안전장치, SIGTERM 처리가 2차

## 구성 요소

| 파일 | 역할 |
|---|---|
| `src/app/api/health/route.ts` | 얕은 헬스 엔드포인트 (신규) |
| `cluster-server.js` | SIGTERM graceful 종료 추가 |
| `nginx/default.conf` | 최소 프록시 설정 (신규) |
| `nginx/upstream.conf` | 활성 색 지정. 배포 스크립트가 생성/교체 |
| `docker-compose.yml` | nginx + web-blue + web-green 로 재구성 |
| `webhook-deploy.sh` | blue/green 배포 오케스트레이션 (신규) |
| `nginx.conf` | 삭제 (미사용 + 위 회귀 위험) |
| 서버 `auto-deployer/webhook.py` | `webhook-deploy.sh` 있으면 실행하는 분기 추가 |

## 알려진 트레이드오프

스왑 순간 옛/새 버전이 수 초간 **동시 실행**된다. 따라서 **DB 스키마 변경은 하위호환이어야 한다**(컬럼 추가는 안전, 이름 변경·삭제는 그 수 초 동안 옛 버전이 깨짐). 지금까지의 마이그레이션은 모두 추가형이라 실질 영향 없음.

## 전환 시 1회 다운타임

현재 `marie-wedding-web-1` 이 3046 을 점유 중이므로, nginx 로 넘기는 최초 전환에는 짧은 다운타임이 불가피하다. 마리에만 해당하며 이후 배포부터 무중단.

## 검증 결과 (2026-07-17 실측)

0.2초 간격 연속 호출로 측정.

| 시나리오 | 결과 |
|---|---|
| 실제 green→blue 교체 (훅 자동배포) | 2,450건 요청 **전부 200, 실패 0건** |
| `/api/health` 를 500 으로 고장낸 배포 | 1,587건 요청 **전부 200, 실패 0건**. 고장난 색은 healthy 가 못 돼 **스왑되지 않고 정리**됨. 옛 색이 계속 서비스 |

## 구축 중 실제로 겪은 사고 (재발 방지)

최초 전환에서 사이트가 약 2분 내려갔다. 원인 3가지 모두 스크립트에 방어를 넣었다.

1. **반쪽짜리 nginx 컨테이너**
   훅의 `docker compose up -d --build` 가 레거시 컨테이너와 포트 충돌로 실패하면서, 네트워킹이 붙지 않은 nginx 컨테이너를 남겼다. 이후 `up -d` 는 "이미 존재함" 으로 보고 그대로 기동해 **포트를 하나도 안 연 채** 떴다.
   → `docker port` 로 실제 바인딩을 확인하고 불일치 시에만 재생성한다.

2. **없는 색으로 롤백**
   최초 전환 땐 옛 색(blue)이 존재하지 않는데 실패 경로가 upstream 을 blue 로 되돌렸다. nginx 가 DNS 해석에 실패해 **전체 502**.
   → 옛 색이 실제 실행 중일 때만 롤백한다.

3. **`upstream.inc` 가 git 추적 대상**
   배포 스크립트가 쓰는 상태 파일인데 git 이 추적하면 `git pull` 이 리포 기본값으로 되돌린다. 스크립트가 활성 색을 오판해 **살아있는 컨테이너를 죽인다**. 게다가 로컬 수정이 있으면 pull 자체가 중단돼 옛 코드로 배포된다(실제로 발생).
   → `.gitignore` 로 제외하고, 활성 색은 파일 → 실행중 컨테이너 순으로 판단한다.

### webhook.py 수정 시 주의

`auto-deployer` 는 Dockerfile 의 `COPY webhook.py .` 로 **이미지에 구운 `/app/webhook.py` 를 실행**한다. 호스트의 `/home/server/apps/auto-deployer/webhook.py` 만 고치고 재시작하면 아무 효과가 없다.
→ `docker cp` 로 컨테이너에 넣고 재시작한다. 이미지 재빌드는 Dockerfile 이 docker-compose 를 `latest` 로 새로 받아 137개 앱의 배포 도구가 바뀌므로 피한다.
