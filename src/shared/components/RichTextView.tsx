interface RichTextViewProps {
  html: string;
  className?: string;
}

// 서버/클라이언트 공용 sanitizer (DOMParser 없이 정규식 기반 - 최소한의 보호)
function sanitizeServer(html: string): string {
  if (!html) return '';
  // script, iframe, style, on* 이벤트 핸들러 등 제거
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<iframe[\s\S]*?<\/iframe>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/\son\w+="[^"]*"/gi, '')
    .replace(/\son\w+='[^']*'/gi, '')
    .replace(/javascript:/gi, '')
    .replace(/<(?!\/?(?:p|br|div|span|strong|b|em|i|u|h2|h3|ul|ol|li|img)\b)[^>]+>/gi, '');
}

export default function RichTextView({ html, className = '' }: RichTextViewProps) {
  const safe = sanitizeServer(html);
  return (
    <div
      className={`rich-text-content ${className}`}
      dangerouslySetInnerHTML={{ __html: safe }}
    />
  );
}
