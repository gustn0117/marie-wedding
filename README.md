# Marié - 웨딩 업계 구인구직 플랫폼

웨딩 업계 종사자(예식장, 드레스샵, 스튜디오, 메이크업샵, 웨딩플래너, 예식 도우미 등)를 위한 구인구직·프로필·커뮤니티 플랫폼입니다.

## 기술 스택

- **Frontend**: Next.js 15 (App Router) + TypeScript + Tailwind CSS
- **Backend**: Supabase (Auth, Database, Storage)
- **배포**: Docker + Nginx

## 프로젝트 구조

```
src/
├── app/                    # Next.js App Router (라우팅)
│   ├── (auth)/             # 인증 페이지 (로그인, 회원가입)
│   └── (main)/             # 메인 페이지 (인증 필요)
│       ├── jobs/           # 채용 공고
│       ├── directory/      # 업체 디렉토리
│       └── community/      # 커뮤니티
├── features/               # Feature-based 모듈
│   ├── auth/               # 인증 (components, services, hooks)
│   ├── jobs/               # 채용 공고
│   ├── directory/          # 업체 디렉토리
│   └── community/          # 커뮤니티
├── shared/                 # 공통 컴포넌트, 훅, 유틸, 상수
├── lib/supabase/           # Supabase 클라이언트 설정
└── types/                  # TypeScript 타입 정의
supabase/
├── schema.sql              # DB 스키마
└── seed.sql                # 시드 데이터
```

## 주요 기능

- **인증**: 이메일 로그인/회원가입, 업종·지역 선택, 인증 미들웨어
- **채용 공고**: 공고 CRUD, 업종/지역/고용형태 필터링, 지원 접수/상태 관리
- **인재·업체 프로필**: 업체 프로필, 갤러리, 업종별/지역별 검색, 공개 여부 관리
- **커뮤니티**: 글 작성/조회/댓글/좋아요/저장, 카테고리별 필터
- **플랫폼 레이어**: 공고·게시글 저장, 알림, 신고 접수 및 관리자 처리
- **관리자**: 회원/공고/게시글/댓글/신고/이벤트 관리

## 로컬 실행 방법

### 사전 준비

1. Node.js 22 설치
2. [Supabase](https://supabase.com) 프로젝트 생성

### 설정

```bash
# 의존성 설치
npm install

# 환경변수 설정
cp .env.example .env.local
# .env.local 파일에 Supabase URL과 Anon Key 입력
```

### Supabase 설정

새 Supabase DB는 Auth·Storage 기본 스키마와 `pg_cron`이 준비된 상태에서 아래 명령으로 초기화합니다. 파일명 정렬이 아니라 검증된 의존 순서로 전체 스키마·RLS·버킷·스케줄을 적용합니다.

```bash
SUPABASE_DB_URL='postgresql://...' npm run db:bootstrap
```

(선택) 초기화 후 `supabase/seed.sql`의 샘플 데이터를 적용할 수 있습니다.

### 개발 서버 실행

```bash
npm run dev
```

http://localhost:3000 에서 확인

### 프로덕션 빌드

```bash
npm run build
npm start
```

## Docker 배포

```bash
# 빌드 및 실행
docker-compose up -d --build

# 로그 확인
docker-compose logs -f
```

### 2026-07-14 릴리스 DB 적용 순서

기존 앱과 새 앱이 잠깐 함께 실행되는 배포에서도 권한 변경으로 요청이 깨지지 않도록 두 단계로 적용합니다. DB 연결 문자열은 `SUPABASE_DB_URL` 또는 `DATABASE_URL`에 넣고, 저장소에 커밋하지 않습니다.

```bash
# 1. 기존 앱이 실행 중일 때 새 테이블/RPC를 먼저 적용
npm run db:release:pre-app

# 2. 새 이미지를 배포하고 기존 Next.js 프로세스가 모두 종료된 것을 확인
docker compose up -d --build

# 3. 마지막으로 브라우저 직접 쓰기와 민감 컬럼 접근을 차단
npm run db:release:security
```

`supabase/migrations`의 과거 `2026-...` 파일은 자체 호스팅 DB에 수동 적용해 온 이력 보관 파일입니다. 파일명 전체를 단순 정렬해 재생하지 말고, 새 환경은 반드시 `npm run db:bootstrap`을 사용합니다.

## 환경변수

| 변수 | 설명 |
|------|------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase 프로젝트 URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase Anonymous Key |
| `SUPABASE_SERVICE_ROLE_KEY` | 서버 전용 Supabase Service Role Key |
| `NEXT_PUBLIC_SUPABASE_SCHEMA` | Supabase DB 스키마 (기본: `marie_wedding`) |
| `ADMIN_PASSWORD` | 비상 관리자 비밀번호 (일반 운영은 `profiles.role = admin` 권장) |
| `ADMIN_SESSION_SECRET` | 관리자 세션 서명용 32바이트 이상 무작위 키 |
| `NEXT_PUBLIC_APP_URL` | 앱 URL (기본: http://localhost:3000) |
| `PORTONE_API_SECRET` | 포트원 V2 서버 API Secret |
| `PORTONE_WEBHOOK_SECRET` | 포트원 Standard Webhook 검증 Secret |
| `OTP_HASH_SALT` | OTP 해시용 운영 전용 무작위 솔트 |
