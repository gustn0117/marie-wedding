import 'server-only';

export type BoundedJsonResult =
  | { ok: true; value: unknown }
  | { ok: false; reason: 'invalid' | 'too_large' };

/** Content-Length가 없거나 거짓이어도 실제 읽은 바이트 수로 JSON 요청 상한을 강제한다. */
export async function readBoundedJson(request: Request, maxBytes: number): Promise<BoundedJsonResult> {
  const header = request.headers.get('content-length');
  if (header !== null) {
    const declared = Number(header);
    if (!Number.isFinite(declared) || declared < 0) return { ok: false, reason: 'invalid' };
    if (declared > maxBytes) return { ok: false, reason: 'too_large' };
  }
  if (!request.body) return { ok: false, reason: 'invalid' };

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > maxBytes) {
        await reader.cancel().catch(() => undefined);
        return { ok: false, reason: 'too_large' };
      }
      chunks.push(value);
    }
    const bytes = new Uint8Array(total);
    let offset = 0;
    for (const chunk of chunks) {
      bytes.set(chunk, offset);
      offset += chunk.byteLength;
    }
    return { ok: true, value: JSON.parse(new TextDecoder().decode(bytes)) };
  } catch {
    return { ok: false, reason: 'invalid' };
  } finally {
    reader.releaseLock();
  }
}
