# 마리에 iOS 앱

사이트(https://marie.co.kr)의 모바일 화면을 앱 안에서 그대로 띄우는 Capacitor 껍데기다.
화면은 사이트가 그리므로 **사이트를 배포하면 앱 화면도 함께 바뀐다.** 스토어에 다시 올릴 일은 아이콘, 이름,
권한, 네이티브 코드(아래 '앱만 하는 일')처럼 앱 자체가 바뀔 때뿐이다.

- 앱 이름 `마리에`, 번들 ID `kr.co.marie.app`, 팀 `U4HRK9DX9S` (번들 ID 는 스토어에 한 번 올리면 바꿀 수 없다)
- 아이폰 전용, 세로 화면만. iOS 15 이상.
- 인터넷이 끊기면 `www/offline.html` 을 보인다.

## 사이트가 앱을 알아보는 법

앱은 사용자 에이전트 끝에 `MarieApp-iOS` 를 붙인다(`capacitor.config.ts` 의 `appendUserAgent`).
사이트 `<head>` 의 감지 스크립트가 이를 보고 `<html data-app="ios">` 를 단다(`src/shared/utils/appShell.ts`).
앱 전용 모양은 모두 이 속성에 건 CSS 라 서버 렌더링·캐시는 브라우저와 같다(`src/app/globals.css` 의 '앱 화면').

| 앱에서만 | 어디서 |
| --- | --- |
| 상태 표시줄·홈 막대 자리 비우기(`--app-top`, `--app-bottom`) | `globals.css`, 머리글 `HeaderClient` |
| 아래 탭(홈·채용정보·인재·업체·커뮤니티·마이) — 첫 화면들에서만 | `AppTabBar` |
| 탭 화면이 아닌 곳의 뒤로 버튼, 로그인·가입 화면 위 막대 | `AppBackButton`, `AppTopBar` |
| 바닥글 숨김(같은 링크는 전체 메뉴에) | `.app-hide` |
| 애플 로그인 버튼(맨 위) | `SocialLoginButtons` → `/api/auth/apple` |

## 앱만 하는 일 (네이티브, `ios/App/App/`)

- `AppleSignInPlugin.swift` — 애플 로그인 창. 사이트가 만든 nonce 를 SHA-256 으로 바꿔 애플에 보내고, 받은 신분 토큰을
  사이트가 `/api/auth/apple` 로 넘기면 GoTrue `signInWithIdToken` 이 세션을 만든다.
  GoTrue 설정: `GOTRUE_EXTERNAL_APPLE_ENABLED=true`, `GOTRUE_EXTERNAL_APPLE_CLIENT_ID=kr.co.marie.app`
  (서버 `/home/server/supabase/docker/docker-compose.yml`, 웹 리디렉트 방식이 아니라 SECRET 은 필요 없다).
- `LinkRouting.swift` — 사이트 밖 링크는 앱 안 브라우저(SFSafariViewController)로, 새 창(`target="_blank"`)으로 여는
  사이트 주소(이력서 첨부 등 로그인이 필요한 것)는 같은 로그인 상태로 앱 안 보기 창에서 연다. `window.print()` 대신 iOS 인쇄 창.
- `MainViewController.swift` — 위 플러그인 등록, 화면 왼쪽 끝에서 밀면 뒤로 가기.

사이트는 Capacitor 라이브러리를 싣지 않고 앱이 심는 `window.Capacitor.Plugins` 를 바로 부른다(`appShell.ts`).

## 준비물

- Node 22 이상: `brew install node@22` 뒤 `export PATH=/opt/homebrew/opt/node@22/bin:$PATH`
- Xcode (Settings > Accounts 에 애플 개발자 계정)

```sh
cd mobile
npm install
npx cap sync ios        # capacitor.config.json·www 를 ios 프로젝트로 복사(저장소에는 없다)
npm run assets          # 아이콘·스플래시를 바꿨을 때만(scripts/make-assets.mjs)
```

## 배포 전에 시험하기 (시뮬레이터)

사이트 변경을 운영에 올리기 전에 앱에서 보려면, 이 컴퓨터에서 사이트를 띄우고 그 주소로 앱을 묶는다.

```sh
# 저장소 루트
npm run build && npx next start -p 3057
# mobile/
APP_SERVER_URL=http://localhost:3057 npx cap sync ios
cd ios/App && xcodebuild -project App.xcodeproj -scheme App -sdk iphonesimulator \
  -destination 'platform=iOS Simulator,name=iPhone 18 Pro' CODE_SIGNING_ALLOWED=NO build
```

**시험이 끝나면 꼭 `npx cap sync ios` 를 다시 돌려 운영 주소로 되돌린다.**

## 스토어에 올리기

1. 운영 주소로 되돌렸는지 확인: `grep '"url"' ios/App/App/capacitor.config.json` → `https://marie.co.kr`
2. 올릴 때마다 빌드 번호(`CURRENT_PROJECT_VERSION`)를 1씩 올린다. 앱 버전(`MARKETING_VERSION`)은 기능이 바뀔 때.
3. 묶고 올리기 (Xcode 에 로그인한 계정으로 서명·업로드):

```sh
cd ios/App
xcodebuild -project App.xcodeproj -scheme App -configuration Release \
  -destination 'generic/platform=iOS' -archivePath build/Marie.xcarchive \
  -allowProvisioningUpdates archive
xcodebuild -exportArchive -archivePath build/Marie.xcarchive \
  -exportOptionsPlist ExportOptions.plist -exportPath build/export -allowProvisioningUpdates
```

`ExportOptions.plist` 의 `destination` 이 `upload` 이면 App Store Connect 로 바로 올라간다(앱 레코드가 먼저 있어야 한다).
Xcode 에서는 Product > Archive → Distribute App 으로 같은 일을 한다.

스토어 문안·심사 메모·개인정보 응답은 [APP_STORE.md](APP_STORE.md).
