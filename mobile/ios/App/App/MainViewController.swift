import UIKit
import WebKit
import Capacitor
import ObjectiveC

/// 앱 첫 화면. Capacitor 웹뷰에 사이트(https://marie.co.kr)를 띄우고, 앱에서만 쓰는 기능을 붙인다.
/// - 애플 로그인(AppleSignInPlugin), 카카오톡 앱으로 로그인(KakaoLoginPlugin)
/// - 사이트 밖 링크는 앱 안 브라우저로, 새 창 링크는 앱 안 보기 창으로(LinkRouting.swift)
/// - 화면 왼쪽 끝에서 밀면 이전 화면으로(사파리와 같은 몸짓)
/// - 입력칸을 누를 때 키보드 위에 뜨는 '‹ › 완료' 막대를 끈다(웹 양식처럼 보이지 않게)
class MainViewController: CAPBridgeViewController {
    // 웹뷰의 uiDelegate 는 약한 참조라 여기서 붙잡아 둔다.
    private var popupRouter: PopupRoutingUIDelegate?

    override open func capacitorDidLoad() {
        // 웹뷰가 첫 화면을 읽기 전에 등록해야 사이트의 window.Capacitor.Plugins 에 실린다.
        bridge?.registerPluginInstance(AppleSignInPlugin())
        bridge?.registerPluginInstance(KakaoLoginPlugin())
        bridge?.registerPluginInstance(MarieShellPlugin())

        FormAccessoryBar.hide()

        guard let webView = webView else { return }
        webView.allowsBackForwardNavigationGestures = true

        let router = PopupRoutingUIDelegate(fallback: webView.uiDelegate, bridge: bridge)
        webView.uiDelegate = router
        popupRouter = router
    }
}

/// 웹뷰 입력칸 위 '‹ › 완료' 막대(form accessory bar) 끄기.
/// 웹뷰의 입력 담당 뷰(WKContentView)가 내주는 inputAccessoryView 를 nil 로 바꾼다 —
/// Capacitor 공식 키보드 플러그인의 setAccessoryBarVisible(false) 와 같은 방법이며, 앱의 다른 입력칸에는 영향이 없다.
/// 클래스를 못 찾으면(웹킷 구조 변경) 아무것도 하지 않아 원래대로 막대가 보일 뿐이다.
private enum FormAccessoryBar {
    private static var done = false

    static func hide() {
        guard !done else { return }
        let selector = #selector(getter: UIResponder.inputAccessoryView)
        guard let contentViewClass = NSClassFromString(["WK", "Content", "View"].joined()),
              let original = class_getInstanceMethod(contentViewClass, selector) else { return }
        let noBar: @convention(block) (AnyObject) -> UIView? = { _ in nil }
        let implementation = imp_implementationWithBlock(noBar)
        // WKContentView 가 직접 가진 메서드가 아니면 그 클래스에만 덧붙이고(상위 UIResponder 는 그대로),
        // 직접 가진 메서드면 그 구현만 바꾼다.
        if !class_addMethod(contentViewClass, selector, implementation, method_getTypeEncoding(original)) {
            method_setImplementation(original, implementation)
        }
        done = true
    }
}
