import UIKit
import WebKit
import SafariServices
import Capacitor

/// 링크를 어디서 열지 정한다.
/// - 사이트(marie.co.kr)와 간편 로그인 주소: 지금 웹뷰에서 (capacitor.config.ts 의 allowNavigation)
/// - 그 밖의 웹 주소: 앱 안 브라우저(SFSafariViewController). Capacitor 기본값은 사파리 앱으로 내보내는 것이라
///   보던 화면을 떠나게 된다.
/// - 새 창(target="_blank", window.open)으로 여는 사이트 주소: 앱 안 보기 창. 이력서 첨부 파일처럼
///   로그인이 필요한 주소는 사파리나 앱 안 브라우저에서 열면 로그인이 안 돼 있어 열리지 않는다.
///   보기 창은 지금 웹뷰와 같은 설정(쿠키)을 쓰므로 그대로 열린다.
enum LinkRouter {
    static func isWeb(_ url: URL) -> Bool {
        let scheme = url.scheme?.lowercased()
        return scheme == "http" || scheme == "https"
    }

    /// 지금 웹뷰 안에서 열어야 하는 주소인지 — 사이트 자신 또는 allowNavigation 목록.
    static func opensInApp(_ url: URL, bridge: CAPBridgeProtocol?) -> Bool {
        guard let host = url.host?.lowercased(), let config = bridge?.config else { return false }
        if host == config.serverURL.host?.lowercased() { return true }
        return config.shouldAllowNavigation(to: host)
    }

    static func presentBrowser(_ url: URL, from viewController: UIViewController?) {
        guard let top = topMost(viewController) else {
            UIApplication.shared.open(url)
            return
        }
        let safari = SFSafariViewController(url: url)
        safari.dismissButtonStyle = .close
        safari.preferredControlTintColor = .marieNavy
        top.present(safari, animated: true)
    }

    static func topMost(_ viewController: UIViewController?) -> UIViewController? {
        var top = viewController
        while let presented = top?.presentedViewController { top = presented }
        return top
    }
}

extension UIColor {
    /// 사이트의 브랜드 남색(#051049)
    static let marieNavy = UIColor(red: 5 / 255, green: 16 / 255, blue: 73 / 255, alpha: 1)
}

/// 앱 껍데기 기능.
/// - shouldOverrideLoad: 지금 웹뷰에서 화면을 옮기기 직전에 Capacitor 가 먼저 묻는 자리. 사이트 밖 웹 주소를
///   앱 안 브라우저로 돌린다. nil 을 돌려주면 Capacitor 가 평소대로 처리한다.
/// - printPage: 웹뷰에서는 window.print() 가 아무 일도 하지 않아, 사이트가 대신 부르는 iOS 인쇄 창(‘PDF로 저장’ 포함).
/// - haptic: 누름·성공·실패 진동(사이트 src/shared/utils/appShell.ts 의 appHaptic). 시스템 설정에서 진동을 끄면 울리지 않는다.
@objc(MarieShellPlugin)
public class MarieShellPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "MarieShellPlugin"
    public let jsName = "MarieShell"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "printPage", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "haptic", returnType: CAPPluginReturnPromise)
    ]

    // 진동 장치를 미리 깨워 두면(prepare) 누른 순간과 진동 사이가 짧아진다. 메인 스레드에서만 만든다.
    private var impactGenerators: [UIImpactFeedbackGenerator.FeedbackStyle: UIImpactFeedbackGenerator] = [:]
    private lazy var selectionGenerator = UISelectionFeedbackGenerator()
    private lazy var notificationGenerator = UINotificationFeedbackGenerator()

    private func impactGenerator(_ style: UIImpactFeedbackGenerator.FeedbackStyle) -> UIImpactFeedbackGenerator {
        if let generator = impactGenerators[style] { return generator }
        let generator = UIImpactFeedbackGenerator(style: style)
        impactGenerators[style] = generator
        return generator
    }

    @objc func haptic(_ call: CAPPluginCall) {
        let style = call.getString("style") ?? "light"
        DispatchQueue.main.async {
            switch style {
            case "selection":
                self.selectionGenerator.selectionChanged()
                self.selectionGenerator.prepare()
            case "success", "warning", "error":
                let type: UINotificationFeedbackGenerator.FeedbackType =
                    style == "success" ? .success : style == "warning" ? .warning : .error
                self.notificationGenerator.notificationOccurred(type)
                self.notificationGenerator.prepare()
            default:
                let impact: UIImpactFeedbackGenerator.FeedbackStyle
                switch style {
                case "medium": impact = .medium
                case "heavy": impact = .heavy
                case "soft": impact = .soft
                case "rigid": impact = .rigid
                default: impact = .light
                }
                let generator = self.impactGenerator(impact)
                generator.impactOccurred()
                generator.prepare()
            }
            call.resolve()
        }
    }

    @objc func printPage(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            guard let webView = self.bridge?.webView else {
                call.reject("화면을 찾지 못했습니다.", "UNAVAILABLE")
                return
            }
            let info = UIPrintInfo(dictionary: nil)
            info.outputType = .general
            info.jobName = webView.title ?? "마리에"
            let controller = UIPrintInteractionController.shared
            controller.printInfo = info
            controller.printFormatter = webView.viewPrintFormatter()
            controller.present(animated: true) { _, completed, error in
                if let error = error {
                    call.reject("인쇄하지 못했습니다.", "FAILED", error)
                } else {
                    call.resolve(["completed": completed])
                }
            }
        }
    }

    override public func shouldOverrideLoad(_ navigationAction: WKNavigationAction) -> NSNumber? {
        guard let url = navigationAction.request.url, LinkRouter.isWeb(url) else { return nil }
        // 새 창은 PopupRoutingUIDelegate 가, 페이지 속 작은 창(iframe)은 웹뷰가 그대로 처리한다.
        guard let frame = navigationAction.targetFrame, frame.isMainFrame else { return nil }
        if LinkRouter.opensInApp(url, bridge: bridge) { return nil }
        LinkRouter.presentBrowser(url, from: bridge?.viewController)
        return true
    }
}

/// 새 창 요청(target="_blank", window.open)을 맡는다. 그 밖의 UI 위임(경고창·확인창 등)은 Capacitor 가
/// 하던 대로 하도록 넘긴다(responds/forwardingTarget).
final class PopupRoutingUIDelegate: NSObject, WKUIDelegate {
    private weak var fallback: WKUIDelegate?
    private weak var bridge: CAPBridgeProtocol?

    init(fallback: WKUIDelegate?, bridge: CAPBridgeProtocol?) {
        self.fallback = fallback
        self.bridge = bridge
        super.init()
    }

    override func responds(to aSelector: Selector!) -> Bool {
        if super.responds(to: aSelector) { return true }
        return fallback?.responds(to: aSelector) ?? false
    }

    override func forwardingTarget(for aSelector: Selector!) -> Any? {
        if let fallback = fallback, fallback.responds(to: aSelector) { return fallback }
        return super.forwardingTarget(for: aSelector)
    }

    func webView(_ webView: WKWebView, createWebViewWith configuration: WKWebViewConfiguration, for navigationAction: WKNavigationAction, windowFeatures: WKWindowFeatures) -> WKWebView? {
        guard let url = navigationAction.request.url else { return nil }
        let presenter = LinkRouter.topMost(bridge?.viewController)

        if LinkRouter.isWeb(url), LinkRouter.opensInApp(url, bridge: bridge), let presenter = presenter {
            // 돌려준 웹뷰에 웹킷이 요청을 실어 연다. 같은 configuration 을 써야 로그인 쿠키가 이어진다.
            let viewer = PopupViewerController(configuration: configuration)
            let navigation = UINavigationController(rootViewController: viewer)
            presenter.present(navigation, animated: true)
            return viewer.webView
        }
        if LinkRouter.isWeb(url) {
            LinkRouter.presentBrowser(url, from: presenter)
        } else {
            UIApplication.shared.open(url)
        }
        return nil
    }
}

/// 새 창으로 연 사이트 주소(첨부 파일·PDF 등)를 보여 주는 창. 위의 '닫기'나 아래로 쓸어내려 닫는다.
final class PopupViewerController: UIViewController, WKUIDelegate {
    let webView: WKWebView
    private var titleObservation: NSKeyValueObservation?

    init(configuration: WKWebViewConfiguration) {
        webView = WKWebView(frame: .zero, configuration: configuration)
        super.init(nibName: nil, bundle: nil)
    }

    @available(*, unavailable)
    required init?(coder: NSCoder) { fatalError("init(coder:) has not been implemented") }

    override func viewDidLoad() {
        super.viewDidLoad()
        view.backgroundColor = .systemBackground
        webView.uiDelegate = self
        webView.allowsLinkPreview = false
        webView.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(webView)
        NSLayoutConstraint.activate([
            webView.topAnchor.constraint(equalTo: view.safeAreaLayoutGuide.topAnchor),
            webView.bottomAnchor.constraint(equalTo: view.bottomAnchor),
            webView.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            webView.trailingAnchor.constraint(equalTo: view.trailingAnchor),
        ])

        navigationItem.leftBarButtonItem = UIBarButtonItem(title: "닫기", style: .done, target: self, action: #selector(close))
        navigationController?.navigationBar.tintColor = .marieNavy
        titleObservation = webView.observe(\.title, options: [.initial, .new]) { [weak self] webView, _ in
            self?.navigationItem.title = webView.title
        }
    }

    @objc private func close() {
        dismiss(animated: true)
    }

    // 보기 창 안에서 다시 새 창을 열면 같은 창에서 연다.
    func webView(_ webView: WKWebView, createWebViewWith configuration: WKWebViewConfiguration, for navigationAction: WKNavigationAction, windowFeatures: WKWindowFeatures) -> WKWebView? {
        if navigationAction.targetFrame == nil { webView.load(navigationAction.request) }
        return nil
    }

    func webViewDidClose(_ webView: WKWebView) {
        dismiss(animated: true)
    }
}
