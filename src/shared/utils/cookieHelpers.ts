/**
 * 브라우저 document.cookie 조작 공용 헬퍼.
 * secure/sameSite/path 등 attribute 불일치로 삭제/만료가 조용히 실패하는 케이스 방지.
 */
export function clearBrowserCookie(name: string): void {
  if (typeof document === 'undefined') return;
  const attrs = 'path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=Lax; Secure';
  document.cookie = `${name}=; ${attrs}`;
  // Secure 없는 fallback (localhost dev)
  document.cookie = `${name}=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT`;
}

export function clearMarieProfileCookie(): void {
  clearBrowserCookie('marie_profile');
}
