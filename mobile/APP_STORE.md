# App Store Connect 입력 내용

App Store Connect(https://appstoreconnect.apple.com) > 앱 > 마리에 에 들어간 값이다.
2026-11-11 1.0 출시 정보를 API 키로 입력했다. 웹에서만 되는 '앱 개인정보 보호'와 '연락처 전화번호'만 사람이 넣는다.
심사용 계정 비밀번호는 공개 저장소라 여기 적지 않는다(App Store Connect '앱 심사 정보'에만 있다).

## 새 앱 만들기 (처음 한 번)

| 항목 | 값 |
| --- | --- |
| 플랫폼 | iOS |
| 이름 | 마리에 - 웨딩 업계 구인구직 |
| 기본 언어 | 한국어 |
| 번들 ID | kr.co.marie.app (목록에 없으면 앱을 한 번 업로드하거나 Xcode 자동 서명이 등록한 뒤 고른다) |
| SKU | marie-ios |
| 사용자 액세스 | 전체 액세스 |

## 앱 정보

| 항목 | 값 |
| --- | --- |
| 부제 (30자) | 예식장·드레스·스튜디오 채용 |
| 카테고리 | 주: 비즈니스, 부: 라이프스타일 |
| 콘텐츠 권한 | 제3자 콘텐츠 없음 |
| 개인정보처리방침 URL | https://marie.co.kr/privacy |

## 가격·판매 국가

- 가격: 무료(기준 국가 대한민국). 앱 안 결제 없음.
- 판매 국가: **대한민국만**(새 나라 자동 추가 끔). 한국어·국내 서비스이고, EU 에서 팔면 DSA 판매자 정보
  (주소·전화)를 스토어에 공개해야 한다. 넓히려면 '가격 및 사용 가능 여부'에서 나라를 더한다.

## 버전 정보 (1.0)

- 빌드: 1.0 (3)
- 출시: 승인되면 자동 출시

**프로모션 텍스트 (170자)**

웨딩 업계 일자리와 인재를 한곳에서. 예식장·드레스·스튜디오·메이크업·플래너 공고를 보고 바로 지원하세요.

**설명 (4000자)**

마리에는 웨딩 업계만 다루는 구인구직 서비스입니다.
예식장, 드레스샵, 스튜디오, 헤어·메이크업, 웨딩플래너, 예식 도우미까지 웨딩 현장의 일자리와 사람을 한곳에서 찾을 수 있어요.

일자리를 찾는 분
• 업종·지역·고용 형태로 웨딩 업계 채용 공고를 찾아보세요.
• 이력서를 한 번 만들어 두면 공고마다 바로 지원할 수 있어요.
• 지원한 공고의 진행 상황을 마이 탭에서 확인하세요.

사람을 찾는 업체
• 채용 공고를 무료로 올리고 받은 지원서를 한곳에서 관리하세요.
• 인재 프로필을 둘러보고 쪽지로 먼저 연락할 수 있어요.

함께 일하는 사람들
• 커뮤니티에서 현장의 질문과 노하우를 나눠요.
• 부적절한 글·댓글·사용자는 신고하거나 차단할 수 있고, 운영팀이 24시간 안에 검토합니다.

간편하게 시작
• Apple, 카카오, 네이버 계정으로 바로 가입할 수 있어요.
• 마이 탭에서 언제든지 회원 탈퇴할 수 있어요.

**키워드 (100자)**

웨딩,채용,구인구직,예식장,드레스,스튜디오,메이크업,웨딩플래너,예식도우미,알바,일자리,이력서,웨딩홀

**지원 URL**: https://marie.co.kr/contact
**마케팅 URL**: https://marie.co.kr
**저작권**: 2026 Marié

## 스크린샷

6.9인치(1320×2868) 4장만 올린다. 작은 화면에는 애플이 줄여 쓴다. 아이폰 전용이라 아이패드용은 없다.

1. 웨딩 업계 구인구직 한곳에서 — 홈(광고가 아닌 '공고 등록' 슬라이드)
2. 지역·업종으로 원하는 공고만 — 채용정보 + 지역 선택 창
3. 근무 조건 확인하고 바로 지원 — 공고 상세
4. Apple·네이버·카카오로 바로 시작 — 로그인

만드는 법: 운영 사이트를 앱 모드(앱 UA → `html[data-app]`)로 440×875pt·3배율로 찍는다. 위 문구(Pretendard, 남색 #051049)와
둥근 화면 카드를 회색(#F3F4F7) 바탕에 합성한 뒤, 투명도 없는 RGB PNG 로 저장한다.
실제 운영 화면만 쓰고, 개인 이름이 보이는 화면(업체 프로필의 담당자 등)은 넣지 않는다.

## 앱 심사 정보

- 로그인 필요: 예
- 사용자 이름: appreview@marie.co.kr (개인 회원, 온보딩·약관 동의 끝, 인재 목록 비노출 — 2026-11-11 생성)
- 암호: App Store Connect 에만
- 연락처: Hyunsu Sim · 전화(사람이 넣음) · admin@marie.co.kr

**메모 (영문 — 심사관용)**

```
Marié is a job board for the wedding industry in Korea (wedding venues, dress shops, studios, make-up artists, planners).

Demo account (above): an individual (job seeker) account that has already completed onboarding.
Sign in: tap the 마이 tab (bottom right) to open the login screen and enter the demo account. "Apple로 로그인" (Sign in with Apple) is the first social login button.
Job posts and company profiles in the app are real businesses, so please do not send applications or messages to them.

Account deletion: 마이 tab > scroll to the bottom > 회원 탈퇴 (Delete account) > 회원 탈퇴 진행 > check "위 안내를 확인했고 회원 탈퇴에 동의합니다" > 탈퇴 진행.

User-generated content safeguards (Guideline 1.2):
- Terms of use with a zero-tolerance policy for objectionable content must be accepted at sign-up (final step of email sign-up, and onboarding after social sign-in).
- Objectionable words are filtered automatically: posts and comments containing them are hidden, and they are masked in messages.
- Report: "신고" button on job posts, community posts, comments, profiles and message threads.
- Block: "차단" button on community posts, comments, profiles and message threads. Blocked users' posts and comments are hidden immediately and the two users can no longer message each other. Manage blocks at 마이 tab > 차단한 사용자.
- Reports are reviewed by the operations team within 24 hours; offending content is removed and the user is restricted or removed.

Native iOS integration: Sign in with Apple, haptic feedback, camera and photo library for profile and résumé photos, external links in SFSafariViewController, and edge-swipe back navigation.

The app has no in-app purchases or paid digital content. Job postings are free.
```

앱의 탈퇴 확인은 '동의 체크'다(웹은 '회원탈퇴 동의' 문구 입력). 한글 자판이 없는 심사관도 탈퇴를 끝까지 할 수 있어야 한다.

## 앱 개인정보 보호 (데이터 수집 응답 — 웹에서만 입력)

추적(Tracking): **아니요** — 다른 회사 앱·웹사이트의 데이터와 결합하거나 광고 목적으로 공유하지 않는다.

| 데이터 유형 | 수집 | 사용자와 연결 | 목적 |
| --- | --- | --- | --- |
| 연락처 정보 — 이름, 이메일 주소, 전화번호, 물리적 주소(업체 주소) | 예 | 예 | 앱 기능 |
| 사용자 콘텐츠 — 사진 또는 비디오, 고객 지원(문의), 기타 사용자 콘텐츠(이력서·공고·글·댓글·쪽지) | 예 | 예 | 앱 기능 |
| 식별자 — 사용자 ID | 예 | 예 | 앱 기능 |
| 사용 데이터 — 제품 상호 작용(방문한 화면) | 예 | 아니요 | 분석 |

방문 측정 두 가지(자체 `/api/track`, 하람 수집기)는 경로·유입·기기와 날마다 바뀌는 해시만 남기고 회원과 잇지 않는다.

## 연령 등급 응답

- 사용자 생성 콘텐츠: 예 (신고·차단·자동 필터 있음)
- 메시지·채팅: 예 (쪽지)
- 소셜 미디어: 예 (커뮤니티 글에 댓글로 반응) / 연령 제한: 아니요
- 광고: 예 (홈 상단 '광고' 표시 배너)
- 무제한 웹 접근: 아니요 (외부 링크는 앱 안 브라우저 창으로 열 뿐 일반 브라우저 기능은 없다)
- 폭력·성적 콘텐츠·도박·약물·의료 등: 없음

## 수출 규정

앱은 HTTPS 같은 표준 암호화만 쓴다 → `ITSAppUsesNonExemptEncryption = NO` (Info.plist 에 이미 있어 업로드할 때마다 묻지 않는다).

## 애플 개발자 사이트에서 한 번 더 할 일

- **Sign in with Apple 이메일 중계**: Certificates, Identifiers & Profiles > Services > Sign in with Apple for Email Communication 에
  발신 도메인 `marie.co.kr` 과 발신 주소 `admin@marie.co.kr` 를 등록한다.
  - 사이트의 모든 메일(새 지원자 알림·인증 코드·비밀번호 재설정)은 `admin@marie.co.kr` 로 나간다(서버 `MAIL_FROM`).
  - 애플은 SPF 를 확인하는데, `marie.co.kr` 에는 이미 걸려 있다.
  - 등록하지 않으면 ‘이메일 가리기’로 가입한 회원에게 보내는 메일(@privaterelay.appleid.com)이 반송된다.
