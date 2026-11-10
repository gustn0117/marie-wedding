import UIKit
import WebKit
import Capacitor

/// 앱 첫 화면. Capacitor 웹뷰에 사이트(https://marie.co.kr)를 띄우고, 앱에서만 쓰는 기능을 붙인다.
/// - 애플 로그인(AppleSignInPlugin)
/// - 사이트 밖 링크는 앱 안 브라우저로, 새 창 링크는 앱 안 보기 창으로(LinkRouting.swift)
/// - 화면 왼쪽 끝에서 밀면 이전 화면으로(사파리와 같은 몸짓)
class MainViewController: CAPBridgeViewController {
    // 웹뷰의 uiDelegate 는 약한 참조라 여기서 붙잡아 둔다.
    private var popupRouter: PopupRoutingUIDelegate?

    override open func capacitorDidLoad() {
        // 웹뷰가 첫 화면을 읽기 전에 등록해야 사이트의 window.Capacitor.Plugins 에 실린다.
        bridge?.registerPluginInstance(AppleSignInPlugin())
        bridge?.registerPluginInstance(MarieShellPlugin())

        guard let webView = webView else { return }
        webView.allowsBackForwardNavigationGestures = true

        let router = PopupRoutingUIDelegate(fallback: webView.uiDelegate, bridge: bridge)
        webView.uiDelegate = router
        popupRouter = router
    }
}
