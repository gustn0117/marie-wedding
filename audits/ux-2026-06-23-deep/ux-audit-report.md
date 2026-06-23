# Marié UX/UI 보강 진단

분석일: 2026-06-23

## 범위

- 주요 공개 화면: 홈, 채용 목록/상세, 디렉토리 목록/상세, 행사, 검색, 커뮤니티
- 인증 화면: 마이페이지, 대시보드, 쪽지 구조
- 관점: 기능 추가가 아니라 정보 우선순위, 신뢰 저하, 모바일 레이아웃, 로딩/쿼리 구조, 폼 사용성

## 캡처

- `screens/job-detail-desktop.png`
- `screens/job-detail-mobile.png`
- `screens/events-desktop.png`
- `screens/events-mobile.png`
- `screens/directory-detail-desktop.png`
- `screens/directory-detail-mobile.png`
- `screens/community-desktop.png`
- `screens/community-mobile.png`

## 최우선 보강

1. 홈 추천 프로필에서 상세 진입 시 404가 발생한다.
   - 홈에서 추천 프로필 링크가 `/directory/8c972031-df0d-4d67-8f33-ef54990ce4dd`로 노출되지만 상세 화면은 `notFound()`가 된다.
   - 사용자는 추천 영역을 믿고 클릭했는데 빈 화면/404를 만나므로 신뢰 훼손이 크다.
   - 관련 코드: `src/app/page.tsx`, `src/features/home/HomeContent.tsx`, `src/app/(main)/directory/[id]/page.tsx`

2. 행사 화면이 "다가오는 행사"라고 말하면서 종료된 행사를 먼저 보여준다.
   - 현재일 2026-06-23 기준, 2026년 3월/5월 종료 행사가 고정 공지로 상단에 노출된다.
   - 홈도 `다가오는 행사·박람회`라고 표시하지만 이벤트 쿼리에 미래/진행 중 필터가 없다.
   - 관련 코드: `src/app/page.tsx:41`, `src/app/(main)/events/page.tsx:27`

3. 채용 상세 대표 이미지가 깨진다.
   - 데이터에 절대 URL이 들어간 경우에도 Supabase storage 경로를 앞에 붙여서 잘못된 이미지 URL을 만든다.
   - 모바일 상세 첫 화면에서 이미지 깨짐이 바로 보여 신뢰도가 떨어진다.
   - 관련 코드: `src/features/jobs/components/JobDetailHero.tsx:27`

4. 인증 마이페이지에서 hydration mismatch가 발생한다.
   - `/mypage` 인증 상태 진입 시 개발 오버레이에 hydration error가 보였다.
   - 마이페이지는 신뢰/지원 관리의 핵심 화면이라 우선 수정 대상이다.

## 정보 우선순위

1. 채용 상세에서 관련 공고가 지원 폼보다 먼저 나온다.
   - 상세 내용을 읽은 직후 사용자가 해야 할 일은 지원/문의인데, `이 업체의 다른 공고`가 먼저 나와 이탈을 만든다.
   - 관련 공고는 지원 박스 아래로 내리는 편이 좋다.
   - 관련 코드: `src/app/(main)/jobs/[id]/page.tsx:82`

2. 대시보드/마이페이지는 조회수 같은 현황보다 검토 필요, 인증, 프로필 완성 같은 행동 항목이 먼저 보여야 한다.
   - 현재는 숫자 카드와 여러 상태가 분산되어 있어 "지금 무엇을 해야 하는지"가 덜 선명하다.

3. 검색 결과 헤더에 같은 문구의 저장 버튼이 두 개 나온다.
   - 실제로는 공고 검색 저장/업체 검색 저장이지만 사용자에게는 같은 `이 검색 저장`으로 보인다.
   - 관련 코드: `src/app/(main)/search/page.tsx:91`

## 모바일 레이아웃

1. 모바일 헤더 우측 액션이 과밀하다.
   - 커뮤니티 아이콘, 알림/저장 아이콘, 로그인/프로필, 햄버거가 한 줄에 몰려 일부 화면에서 잘려 보인다.
   - 관련 코드: `src/shared/components/HeaderClient.tsx:130`

2. 행사 페이지 상단 버튼이 390px 모바일에서 잘린다.
   - `스태프 공고 보기`, `행사 공고 등록`이 헤더 actions 영역에서 오른쪽으로 밀린다.
   - 관련 코드: `src/shared/components/PageHeader.tsx:35`, `src/app/(main)/events/page.tsx:89`

3. 디렉토리 모바일 목록은 2열 카드라 이미지 영역이 정보보다 크게 보인다.
   - 사진이 없는 업체는 큰 이니셜 카드가 반복되고, 신뢰 지표/지역/업종 스캔이 약해진다.
   - 모바일은 1열 compact row 또는 더 낮은 썸네일 비율이 적합하다.
   - 관련 코드: `src/features/directory/components/CompanyList.tsx:49`, `src/features/directory/components/CompanyCard.tsx:30`

4. 채용 목록 모바일 행은 회사/인증/지역/조건/CTA가 한 행에 많이 압축된다.
   - 지원자는 제목, 회사 신뢰, 근무 조건, 마감 순서로 읽어야 하는데 시선 경로가 빡빡하다.

## 로딩/성능

1. 쪽지 목록은 대화 개수만큼 추가 쿼리가 발생한다.
   - 대화 목록 조회 후 각 대화마다 마지막 메시지와 unread count를 순차 조회한다.
   - 대화가 늘면 마이페이지 쪽지 첫 로딩이 눈에 띄게 느려진다.
   - 관련 코드: `src/app/(main)/mypage/messages/page.tsx:43`

2. 디렉토리 상세는 프로필 이후 공고/포트폴리오/리뷰/태그를 순차로 불러온다.
   - 프로필 조회 뒤 독립 데이터는 병렬화할 수 있다.
   - 관련 코드: `src/app/(main)/directory/[id]/page.tsx`

3. 채용 목록은 마감 공고를 페이지네이션 이후 클라이언트 쪽에서 제외한다.
   - count와 실제 표시 개수가 어긋날 수 있고, 페이지 끝이 빈 느낌을 줄 수 있다.
   - 관련 코드: `src/app/(main)/jobs/page.tsx:43`

## 폼/관리 화면

1. 공고 등록 첫 단계가 실질 선택 없이 안내 카드처럼 동작한다.
   - 사용자는 공고를 빨리 등록하고 싶은데, 실제 입력 전에 progress/checklist와 설명을 먼저 처리해야 한다.

2. 커뮤니티 글 작성은 짧은 글에도 카드가 많이 쌓인다.
   - 카테고리, 지역, 제목, 본문이 각각 큰 카드라 모바일에서 작성 시작까지 체감 거리가 길다.

3. 프로필 수정과 디렉토리 등록 폼의 입력 능력이 다르다.
   - 같은 bio 성격인데 한쪽은 단순 textarea, 다른 쪽은 rich text다.
   - 지역도 채용 공고는 세부 지역을 고를 수 있지만 프로필은 큰 지역 중심이라 정밀도가 다르다.

4. 포트폴리오 이미지는 모바일에서 hover 기반 제어가 약하다.
   - `대표로`, `삭제` 액션이 터치 환경에서 덜 명확하다.
   - 이미지 업로드 시 임시 DB row를 먼저 만들기 때문에 이탈 시 미완성 데이터가 남을 수 있다.
