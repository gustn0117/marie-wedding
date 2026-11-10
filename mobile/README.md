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

## 스토어·TestFlight 에 올리기

팀에 등록된 기기가 없어서 Xcode 자동 서명으로는 아카이브가 안 된다. 자동 서명은 개발용 프로필이 필요한데, 기기가 없으면
그 프로필을 못 만들기 때문이다("Your team has no devices…"). 그래서 **아카이브부터 배포 인증서와 App Store 프로필로 수동 서명**한다.
프로젝트 파일은 자동 서명 그대로 두고, 명령줄에서만 바꾼다(시뮬레이터 빌드는 영향 없음).

- 배포 인증서 `Apple Distribution: HYUNSU SIM (U4HRK9DX9S)`: 이 Mac 키체인에 있다. 2027-11-10 만료.
- 프로필 `Marie App Store`: App Store 용이고 애플 로그인 권한이 들어 있다. 2027-11-10 만료.
  - 없거나 만료되면 다시 만든다. 개발자 사이트 Profiles > + > App Store Connect 에서 번들 `kr.co.marie.app` 과 위 인증서를 고르거나,
    App Store Connect API 를 쓴다. 만든 파일은 `~/Library/Developer/Xcode/UserData/Provisioning Profiles/` 에 넣는다.
  - 인증서를 새로 발급하면 프로필도 다시 만들어야 한다.

1. 운영 주소로 되돌렸는지 확인한다: `grep '"url"' ios/App/App/capacitor.config.json` → `https://marie.co.kr`
2. 올릴 때마다 빌드 번호(`CURRENT_PROJECT_VERSION`)를 1씩 올린다. 같은 번호는 다시 못 올린다. 앱 버전(`MARKETING_VERSION`)은 기능이 바뀔 때 올린다.
3. 묶는다:

```sh
cd ios/App
xcodebuild archive -project App.xcodeproj -scheme App -configuration Release \
  -destination 'generic/platform=iOS' -archivePath build/Marie.xcarchive \
  CODE_SIGN_STYLE=Manual CODE_SIGN_IDENTITY="Apple Distribution" \
  PROVISIONING_PROFILE_SPECIFIER="Marie App Store" DEVELOPMENT_TEAM=U4HRK9DX9S
```

4. 올린다. App Store Connect 에 앱 레코드가 먼저 있어야 하며, 앱 레코드는 API 로 만들 수 없고 웹에서만 만든다.

```sh
xcodebuild -exportArchive -archivePath build/Marie.xcarchive \
  -exportOptionsPlist ExportOptions.plist -exportPath build/export
```

   - Xcode 에 로그인한 계정으로 올라간다.
   - App Store Connect API 키로 올리려면 `-authenticationKeyPath ~/.appstoreconnect/private_keys/AuthKey_<키ID>.p8 -authenticationKeyID <키ID> -authenticationKeyIssuerID <발급자ID>` 를 붙인다.
   - 올리지 않고 IPA 만 만들려면 `ExportOptions.plist` 의 `destination` 을 `export` 로 바꾼 사본을 쓴다.
5. 애플이 처리를 마치면(5~30분) App Store Connect > TestFlight 에 빌드가 뜬다.
   - 내부 테스트 그룹 「마리에 내부 테스트」는 새 빌드를 자동으로 받는다.
   - 아이폰의 TestFlight 앱에서 설치한다.

스토어 문안·심사 메모·개인정보 응답은 [APP_STORE.md](APP_STORE.md).
