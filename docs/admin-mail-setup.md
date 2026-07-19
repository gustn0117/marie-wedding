# 관리자 메일함 (admin@marie.co.kr) 설정 가이드

관리자 페이지 `/admin/mail` 에서 admin@marie.co.kr 로 **발송·수신·읽기·답장**을 모두 할 수 있게 하는 설정.

## 구조

```
발송:  관리자 페이지 → /api/admin/mail(send) → 서버 Postfix+opendkim → 상대방
수신:  상대방 → Cloudflare Email Routing(MX) → Email Worker → /api/mail/inbound → DB(admin_mail)
                                                                          ↓
관리:  관리자 페이지 /admin/mail 가 DB 를 읽어 받은/보낸편지함 표시
```

- **발송은 이미 동작**한다(서버 Postfix, SPF `ip4:211.241.100.210` 승인됨). 관리자 페이지 UI 만 추가됨.
- **수신은 Cloudflare Email Routing** 으로 받는다(서버 25번 인바운드 불필요, 한국 ISP 차단 영향 없음).

## 앱/DB (이미 코드로 반영·배포됨)

- DB: `marie_wedding.admin_mail` 테이블(RLS, service_role 전용).
- 수신: `POST /api/mail/inbound` (헤더 `x-mail-secret` 로 인증, 원본을 postal-mime 으로 파싱해 저장).
- 관리자 API: `GET/POST /api/admin/mail` (HMAC 관리자 세션 인증).
- UI: `/admin/mail` (좌측 네비 "메일함").
- 서버 `.env` 에 `MAIL_INBOUND_SECRET` 추가됨(수신 인증 공유키).

## Cloudflare 대시보드 설정 (사장님이 진행 — 5분)

### 1) Email Routing 활성화
1. Cloudflare 대시보드 → **marie.co.kr** 선택 → 좌측 **Email** → **Email Routing**.
2. **Enable Email Routing** 클릭. → MX 레코드가 자동 추가된다(수신 준비 완료).

> ⚠️ **SPF 주의(발송 유지):** Email Routing 이 SPF TXT 를 건드릴 수 있다. 활성화 후
> DNS → TXT 레코드에서 SPF 가 **발송 서버 IP 를 계속 포함**하는지 확인한다. 다음 형태여야 한다:
> ```
> v=spf1 ip4:211.241.100.210 include:_spf.mx.cloudflare.net ~all
> ```
> (기존 `v=spf1 ip4:211.241.100.210 ~all` 에 `include:_spf.mx.cloudflare.net` 를 더한 것.
> Cloudflare 것만 남고 `ip4:211.241.100.210` 이 빠지면 **발송 메일이 스팸 처리**될 수 있으니 반드시 병합.)

### 2) Email Worker 생성
1. **Email Routing → Email Workers → Create** (또는 Workers & Pages → Create Worker).
2. `cloudflare/email-worker/worker.js` 의 내용을 그대로 붙여넣고 **Deploy**.
3. 그 Worker → **Settings → Variables and Secrets** → 변수 추가:
   - 이름: `MAIL_INBOUND_SECRET`
   - 값: (서버 `.env` 의 `MAIL_INBOUND_SECRET` 과 **동일한 값**)
   - Encrypt(Secret)로 저장 권장. 저장 후 Deploy.

### 3) 라우팅 규칙
1. **Email Routing → Routing rules**.
2. **Custom addresses → Create address**:
   - Custom address: `admin@marie.co.kr`
   - Action: **Send to a Worker** → 위에서 만든 Worker 선택 → Save.
3. (선택) **Catch-all address** 도 같은 Worker 로 두면 marie.co.kr 로 오는 모든 주소를 받는다.

### 4) 테스트
1. 개인 지메일 등 외부 계정에서 `admin@marie.co.kr` 로 메일 발송.
2. 관리자 페이지 → **메일함 → 받은편지함** 에 몇 초 내 도착 확인.
3. 관리자 페이지에서 **답장** → 상대방이 admin@marie.co.kr 발신으로 수신 확인.

## 문제 해결
- 받은편지함에 안 옴: (a) Routing rule 이 Worker 로 가는지, (b) Worker 의 `MAIL_INBOUND_SECRET`
  이 서버 `.env` 값과 일치하는지, (c) Worker 로그(Cloudflare)에서 relay 실패 상태코드 확인.
- 401 unauthorized: secret 불일치. 서버 `.env` 재확인 후 재배포(컨테이너 재생성 필요).
- 발송이 스팸행: 위 SPF 병합 확인. DKIM(opendkim)·PTR 은 서버측(별도).
