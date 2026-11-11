import Foundation
import UIKit
import CryptoKit
import Capacitor
import KakaoSDKCommon
import KakaoSDKAuth
import KakaoSDKUser

/// 카카오톡 앱으로 로그인(네이티브). 사이트가 window.Capacitor.Plugins.KakaoLogin.login({ nonce }) 로 부른다.
///
/// 웹 카카오 로그인은 앱 화면(웹뷰) 안에서 열려 휴대폰의 카카오톡 로그인 상태를 쓰지 못한다 — 카카오톡에 로그인돼
/// 있어도 아이디·비밀번호를 다시 넣어야 했다. 여기서는 카카오 SDK 로 카카오톡 앱을 열어 확인만 받고 돌아온다.
///
/// 흐름은 애플 로그인과 같다: 사이트가 만든 nonce 를 SHA-256 으로 바꿔 카카오에 보낸다 → 카카오가 그 값을 담은
/// ID 토큰(OpenID Connect)을 돌려준다 → 사이트 서버(/api/auth/kakao)가 토큰과 원래 nonce 를
/// Supabase(signInWithIdToken)에 넘겨 로그인한다. 원래 nonce 를 아는 쪽만 토큰을 쓸 수 있다.
///
/// 거절 code — CANCELED: 취소했거나 카카오톡에서 그냥 돌아옴, TALK_UNAVAILABLE: 카카오톡이 없음,
/// UNAVAILABLE: 카카오 앱 키 없음, NO_ID_TOKEN: 카카오 개발자 콘솔의 OpenID Connect 가 꺼짐, FAILED: 그 밖.
/// 사이트는 CANCELED 말고는 웹 로그인(카카오 계정 화면)으로 이어 간다.
///
/// 카카오 네이티브 앱 키는 빌드 설정 KAKAO_NATIVE_APP_KEY → Info.plist 의 KakaoNativeAppKey 와
/// 돌아오는 주소 kakao{앱 키}://oauth 로 들어간다. 키가 비어 있으면 아무것도 켜지 않는다.
@objc(KakaoLoginPlugin)
public class KakaoLoginPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "KakaoLoginPlugin"
    public let jsName = "KakaoLogin"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "login", returnType: CAPPluginReturnPromise)
    ]

    // MARK: SDK 준비·돌아온 주소 (AppDelegate·SceneDelegate 가 부른다)

    private(set) static var isConfigured = false
    /// 카카오톡이 로그인 결과 주소로 앱을 다시 열었는지 — 결과 없이 그냥 돌아온 것과 구분한다.
    private static var callbackArrived = false

    private static var appKey: String? {
        guard let raw = Bundle.main.object(forInfoDictionaryKey: "KakaoNativeAppKey") as? String else { return nil }
        let key = raw.trimmingCharacters(in: .whitespacesAndNewlines)
        return key.isEmpty || key.contains("$(") ? nil : key
    }

    /// 앱이 켜질 때 한 번. 키가 없으면 SDK 를 켜지 않는다(그러면 login 은 UNAVAILABLE).
    static func configure() {
        guard !isConfigured, let key = appKey else { return }
        KakaoSDK.initSDK(appKey: key)
        isConfigured = true
    }

    /// 카카오톡이 돌려보낸 주소(kakao{앱 키}://oauth?...)면 SDK 에 넘기고 true.
    @MainActor
    static func handleOpenURL(_ url: URL) -> Bool {
        guard isConfigured, AuthApi.isKakaoTalkLoginUrl(url) else { return false }
        callbackArrived = true
        return AuthController.handleOpenUrl(url: url)
    }

    // MARK: 로그인

    private var pendingCall: CAPPluginCall?
    private var leftApp = false

    public override func load() {
        NotificationCenter.default.addObserver(self, selector: #selector(appDidEnterBackground),
                                               name: UIApplication.didEnterBackgroundNotification, object: nil)
        NotificationCenter.default.addObserver(self, selector: #selector(appDidBecomeActive),
                                               name: UIApplication.didBecomeActiveNotification, object: nil)
    }

    @objc func login(_ call: CAPPluginCall) {
        guard let nonce = call.getString("nonce"), nonce.count >= 16 else {
            call.reject("nonce 가 없습니다.", "INVALID_ARGUMENT")
            return
        }
        DispatchQueue.main.async {
            guard Self.isConfigured else {
                call.reject("카카오톡 로그인이 설정되지 않았습니다.", "UNAVAILABLE")
                return
            }
            // 앞선 시도가 안 끝났으면(카카오톡에서 아무것도 안 하고 와서 다시 누름) 그 시도는 취소로 끝낸다.
            // SDK 도 새 요청으로 바꾸므로 앞선 시도의 결과는 오지 않는다.
            self.pendingCall?.reject("카카오톡 로그인을 다시 시작했습니다.", "CANCELED")
            self.pendingCall = call
            self.leftApp = false
            Self.callbackArrived = false

            // 플러그인은 앱이 켜져 있는 동안 브리지가 붙잡고 있어 self 를 그대로 잡아도 된다.
            UserApi.shared.loginWithKakaoTalk(nonce: Self.sha256Hex(nonce)) { token, error in
                DispatchQueue.main.async { self.finish(call, token: token, error: error) }
            }
        }
    }

    private func finish(_ call: CAPPluginCall, token: OAuthToken?, error: Error?) {
        // 이미 끝냈거나(그냥 돌아와 취소 처리) 새 시도로 바뀐 호출이면 무시한다.
        guard pendingCall === call else { return }
        pendingCall = nil

        if let error = error {
            reject(call, error)
            return
        }
        // 사이트 세션만 쓰고 카카오 토큰은 앱에 남기지 않는다 — 카카오 쪽 토큰을 만료시키고 앱에 저장된 것도 지운다.
        // (카카오톡 앱의 로그인과 앱 연결은 그대로다.) ID 토큰은 서명으로 확인하므로 만료와 상관없다.
        defer { UserApi.shared.logout { _ in } }
        guard let idToken = token?.idToken, !idToken.isEmpty else {
            call.reject("카카오에서 ID 토큰을 받지 못했습니다.", "NO_ID_TOKEN")
            return
        }
        call.resolve(["idToken": idToken])
    }

    private func reject(_ call: CAPPluginCall, _ error: Error) {
        if let sdkError = error as? SdkError {
            if sdkError.isClientFailed {
                switch sdkError.getClientError().reason {
                case .Cancelled:
                    call.reject("카카오톡 로그인을 취소했습니다.", "CANCELED")
                    return
                case .NotSupported:
                    call.reject("카카오톡이 없어 카카오톡으로 로그인할 수 없습니다.", "TALK_UNAVAILABLE")
                    return
                default:
                    break
                }
            } else if sdkError.isAuthFailed, sdkError.getAuthError().reason == .AccessDenied {
                // 카카오톡 동의 화면에서 '취소'
                call.reject("카카오톡 로그인을 취소했습니다.", "CANCELED")
                return
            }
        }
        call.reject("카카오톡 로그인에 실패했습니다.", "FAILED", error)
    }

    // MARK: 결과 없이 돌아왔을 때

    @objc private func appDidEnterBackground() {
        if pendingCall != nil { leftApp = true }
    }

    /// 카카오톡에서 아무것도 안 하고 앱으로 돌아오면 SDK 는 끝내 답하지 않는다. 그대로 두면 사이트 버튼이
    /// '연결 중'에 멈추므로, 돌아온 뒤 결과 주소가 오지 않으면 취소로 끝낸다. 결과 주소는 앱이 다시 켜지는 것과
    /// 거의 같이 오므로 잠깐 기다린다.
    @objc private func appDidBecomeActive() {
        guard let call = pendingCall, leftApp else { return }
        leftApp = false
        DispatchQueue.main.asyncAfter(deadline: .now() + 1.5) { [weak self] in
            guard let self = self, self.pendingCall === call, !Self.callbackArrived else { return }
            self.pendingCall = nil
            call.reject("카카오톡 로그인을 취소했습니다.", "CANCELED")
        }
    }

    private static func sha256Hex(_ input: String) -> String {
        SHA256.hash(data: Data(input.utf8)).map { String(format: "%02x", $0) }.joined()
    }
}
