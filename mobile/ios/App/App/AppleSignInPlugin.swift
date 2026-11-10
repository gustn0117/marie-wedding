import Foundation
import UIKit
import AuthenticationServices
import CryptoKit
import Capacitor

/// 애플 로그인(네이티브). 사이트가 window.Capacitor.Plugins.AppleSignIn.authorize({ nonce }) 로 부른다.
///
/// 흐름: 사이트가 임의 문자열(nonce)을 만들어 넘긴다 → 여기서 SHA-256 으로 바꿔 애플에 보낸다 →
/// 애플이 그 값을 담은 신분 토큰(identityToken)을 돌려준다 → 사이트 서버가 토큰과 원래 nonce 를
/// Supabase(signInWithIdToken)에 넘겨 로그인한다. 원래 nonce 를 아는 쪽만 토큰을 쓸 수 있다.
///
/// 이름과 이메일은 애플이 처음 승인할 때 한 번만 준다. 그래서 받은 즉시 사이트로 넘긴다.
@objc(AppleSignInPlugin)
public class AppleSignInPlugin: CAPPlugin, CAPBridgedPlugin, ASAuthorizationControllerDelegate, ASAuthorizationControllerPresentationContextProviding {
    public let identifier = "AppleSignInPlugin"
    public let jsName = "AppleSignIn"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "authorize", returnType: CAPPluginReturnPromise)
    ]

    private var pendingCall: CAPPluginCall?
    private var controller: ASAuthorizationController?

    @objc func authorize(_ call: CAPPluginCall) {
        guard let nonce = call.getString("nonce"), !nonce.isEmpty else {
            call.reject("nonce 가 없습니다.", "INVALID_ARGUMENT")
            return
        }
        DispatchQueue.main.async {
            if self.pendingCall != nil {
                call.reject("애플 로그인이 이미 진행 중입니다.", "IN_PROGRESS")
                return
            }
            self.pendingCall = call

            let request = ASAuthorizationAppleIDProvider().createRequest()
            request.requestedScopes = [.fullName, .email]
            request.nonce = Self.sha256Hex(nonce)

            let controller = ASAuthorizationController(authorizationRequests: [request])
            controller.delegate = self
            controller.presentationContextProvider = self
            self.controller = controller
            controller.performRequests()
        }
    }

    public func presentationAnchor(for controller: ASAuthorizationController) -> ASPresentationAnchor {
        if let window = bridge?.webView?.window { return window }
        let scene = UIApplication.shared.connectedScenes.compactMap { $0 as? UIWindowScene }.first
        return scene?.windows.first(where: { $0.isKeyWindow }) ?? ASPresentationAnchor()
    }

    public func authorizationController(controller: ASAuthorizationController, didCompleteWithAuthorization authorization: ASAuthorization) {
        guard let call = takePendingCall() else { return }
        guard let credential = authorization.credential as? ASAuthorizationAppleIDCredential,
              let tokenData = credential.identityToken,
              let identityToken = String(data: tokenData, encoding: .utf8) else {
            call.reject("애플에서 로그인 정보를 받지 못했습니다.", "NO_TOKEN")
            return
        }

        var result: [String: Any] = [
            "identityToken": identityToken,
            "user": credential.user,
        ]
        if let codeData = credential.authorizationCode, let code = String(data: codeData, encoding: .utf8) {
            result["authorizationCode"] = code
        }
        if let email = credential.email { result["email"] = email }
        if let givenName = credential.fullName?.givenName { result["givenName"] = givenName }
        if let familyName = credential.fullName?.familyName { result["familyName"] = familyName }
        call.resolve(result)
    }

    public func authorizationController(controller: ASAuthorizationController, didCompleteWithError error: Error) {
        guard let call = takePendingCall() else { return }
        if let authError = error as? ASAuthorizationError, authError.code == .canceled {
            call.reject("애플 로그인을 취소했습니다.", "CANCELED")
        } else {
            call.reject("애플 로그인에 실패했습니다.", "FAILED", error)
        }
    }

    private func takePendingCall() -> CAPPluginCall? {
        let call = pendingCall
        pendingCall = nil
        controller = nil
        return call
    }

    private static func sha256Hex(_ input: String) -> String {
        SHA256.hash(data: Data(input.utf8)).map { String(format: "%02x", $0) }.joined()
    }
}
