/**
 * Cloudflare Email Worker — admin@marie.co.kr 수신 메일을 마리에 앱으로 전달한다.
 *
 * 파싱은 앱(/api/mail/inbound)이 postal-mime 으로 처리하므로, 이 Worker 는 의존성 없이
 * Cloudflare 대시보드에 그대로 붙여넣으면 된다.
 *
 * 필요한 환경변수(Worker Settings → Variables):
 *   MAIL_INBOUND_SECRET = (서버 .env 의 값과 동일해야 함)
 */
export default {
  async email(message, env) {
    // 원본(rfc822) 스트림 → 텍스트
    const raw = await new Response(message.raw).text();

    try {
      const res = await fetch('https://marie.co.kr/api/mail/inbound', {
        method: 'POST',
        headers: {
          'content-type': 'message/rfc822',
          'x-mail-secret': env.MAIL_INBOUND_SECRET,
          'x-env-from': message.from || '',
          'x-env-to': message.to || '',
        },
        body: raw,
      });
      if (!res.ok) {
        console.log('inbound relay failed:', res.status, await res.text());
      }
    } catch (e) {
      console.log('inbound relay error:', e && e.message);
    }

    // (선택) 원본을 개인 지메일로도 백업 포워드하려면 아래 주석 해제 + Cloudflare 에서
    // 해당 목적지 주소를 Verify 해야 한다:
    // await message.forward('tlagustn020117@gmail.com');
  },
};
