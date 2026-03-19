# Marié - 웨딩 업계 B2B 네트워크 플랫폼

웨딩 업계 종사자(예식장, 드레스샵, 스튜디오, 메이크업샵, 웨딩플래너, 예식 도우미 등)를 위한 B2B 네트워크 플랫폼입니다.

## 기술 스택

- **Frontend**: Next.js 14 (App Router) + TypeScript + Tailwind CSS
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
- **채용 공고**: 공고 CRUD, 업종/지역/고용형태 필터링, 긴급매칭
- **업체 디렉토리**: 업체 프로필, 업종별/지역별 검색
- **커뮤니티**: 글 작성/조회/댓글, 카테고리별 필터

## 로컬 실행 방법

### 사전 준비

1. Node.js 18+ 설치
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

1. Supabase 대시보드에서 SQL Editor 열기
2. `supabase/schema.sql` 실행하여 테이블 생성
3. (선택) `supabase/seed.sql`의 주석을 해제하고 실행하여 샘플 데이터 삽입

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

## 환경변수

| 변수 | 설명 |
|------|------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase 프로젝트 URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase Anonymous Key |
| `NEXT_PUBLIC_APP_URL` | 앱 URL (기본: http://localhost:3000) |
