import type { CapacitorConfig } from '@capacitor/cli';

// 마리에 앱. 사이트(https://marie.co.kr)의 모바일 화면을 앱 안에서 그대로 띄운다. 사이트를 배포하면 앱 화면도 함께 바뀐다.
// 사이트는 사용자 에이전트 끝의 표시(MarieApp-iOS)로 앱 안인지 알고, 앱일 때만 상태 표시줄·홈 막대 자리를 비우고
// 아래 탭과 애플 로그인을 보인다(사이트의 src/shared/utils/appShell.ts).
// 배포 전에 시험할 때만 APP_SERVER_URL 로 다른 주소(예: 이 컴퓨터의 http://localhost:3057)를 띄운다.
const site = process.env.APP_SERVER_URL ?? 'https://marie.co.kr';

const config: CapacitorConfig = {
  appId: 'kr.co.marie.app',
  appName: '마리에',
  webDir: 'www',
  backgroundColor: '#ffffff',
  server: {
    url: site,
    cleartext: site.startsWith('http://'),
    // 이 목록의 주소는 지금 화면(웹뷰)에서 연다. 그 밖의 웹 주소는 앱 안 브라우저 창으로 뜬다
    // (ios/App/App/LinkRouting.swift). 간편 로그인은 로그인 상태가 앱으로 돌아오도록 이 목록에 둔다.
    //  · 카카오: 사이트 → 인증 서버(api.hsweb.pics) → 카카오 → 인증 서버 → 사이트
    //  · 네이버: 사이트 → 네이버 → 사이트
    allowNavigation: [
      'marie.co.kr',
      'www.marie.co.kr',
      'api.hsweb.pics',
      'kauth.kakao.com',
      'accounts.kakao.com',
      'nid.naver.com',
    ],
    // 인터넷이 끊겨 사이트를 못 열면 앱에 든 안내 화면을 보인다.
    errorPath: 'offline.html',
  },
  ios: {
    appendUserAgent: 'MarieApp-iOS',
    // 화면 끝까지 그리고, 상태 표시줄·홈 막대 자리는 사이트가 safe-area 값만큼 비운다.
    contentInset: 'never',
    // 링크를 길게 눌렀을 때 뜨는 사파리 미리보기(‘사파리에서 열기’ 등)를 끈다.
    allowsLinkPreview: false,
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 1200,
      launchFadeOutDuration: 250,
      backgroundColor: '#ffffff',
      showSpinner: false,
    },
    // 흰 머리글 위라서 상태 표시줄 글자와 아이콘을 검게 둔다(LIGHT = 밝은 바탕용).
    StatusBar: {
      style: 'LIGHT',
    },
  },
};

export default config;
