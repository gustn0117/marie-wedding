# Marié — PHP 버전 (카페24 호스팅용)

Next.js로 만든 [메인 프로젝트](../)의 PHP 포팅 버전입니다.
Supabase는 그대로 유지하고, PHP에서 PostgREST API를 호출하는 구조입니다.

## 기술 스택

- **PHP 7.4+** (카페24 표준)
- **Supabase** (자체 호스팅, `https://api.hsweb.pics`)
  - PostgREST → DB·RPC
  - GoTrue → 인증
  - Storage → 파일
- **Tailwind CSS** (Play CDN, 운영 시 빌드된 CSS 권장)
- **Pretendard** (한글 폰트)

## 디렉토리 구조

```
php/
├── public/              # Apache document root
│   ├── index.php       # Front controller (라우터 진입점)
│   ├── .htaccess       # mod_rewrite
│   └── assets/
│       ├── css/
│       ├── js/
│       └── img/
├── src/
│   ├── config.php      # Supabase 설정·세션
│   ├── core/
│   │   ├── Router.php
│   │   ├── Supabase.php   # PostgREST 클라이언트
│   │   ├── Auth.php       # Supabase Auth + PHP session
│   │   ├── View.php       # 템플릿 렌더링
│   │   └── Helpers.php    # 라벨·날짜·CSRF 유틸
│   ├── controllers/
│   ├── views/
│   └── ...
└── README.md
```

## 카페24 호스팅 업로드 가이드

1. 카페24 웹FTP 또는 FileZilla로 접속
2. `public_html/` (또는 호스팅에서 지정한 도큐먼트 루트) 아래에 업로드:
   - `php/public/*` → `public_html/` 직접
   - `php/src/*` → `public_html/` 위 한 단계 (예: `php_src/`)
3. `src/config.php`에서 다음 값 확인:
   - `SUPABASE_URL` — 자체 호스팅 Supabase 도메인
   - `SUPABASE_ANON_KEY` — 공개 가능
4. `index.php`의 `require __DIR__ . '/../src/...'` 경로를 카페24 환경에 맞게 조정
5. `.htaccess`의 `mod_rewrite` 활성화 (카페24 표준)

## 진행 현황

**완료** ✓
- 인프라 (Router, Supabase 클라이언트, Auth, View, Helpers)
- 홈
- 로그인 / 회원가입 / 로그아웃
- 공고 리스트 / 공고 상세
- 404
- 레이아웃 (헤더, 푸터)

**미진행 (다음 단계)**
- 업체 디렉토리 (리스트 / 상세 / 등록)
- 커뮤니티 (리스트 / 상세 / 작성)
- 마이페이지 (프로필 / 신청 / 포트폴리오 / 메시지 등)
- 이벤트
- 관리자 패널
- 검색 페이지
- 신청·리뷰·인증 흐름
- 토스트 / 확인 모달
- 파일 업로드
- 신뢰 배지·포트폴리오·리뷰 UI
- 알림
- 헤더 모바일 메뉴

각 페이지를 한 응답에 한두 모듈씩 추가합니다.

## 운영 메모

- 운영 시 `config.php`를 `public/` 외부에 두고 `require '__DIR__ . '/../src/config.php'` 유지
- `display_errors` OFF, 에러 로그만 활용
- 운영 배포 후 Tailwind CDN은 빌드된 CSS로 교체 권장 (CDN은 prod 권장하지 않음)
- 세션 이름은 `marie_session`, 7일 유지
