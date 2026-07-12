import sanitizeHtml from 'sanitize-html';

interface RichTextViewProps {
  html: string;
  className?: string;
}

function sanitizeServer(html: string): string {
  if (!html) return '';
  return sanitizeHtml(html, {
    allowedTags: ['p', 'br', 'div', 'span', 'strong', 'b', 'em', 'i', 'u', 'h2', 'h3', 'ul', 'ol', 'li', 'img'],
    allowedAttributes: {
      // 정렬·크기 스타일이 모든 블록 태그에서 살아있도록 style 허용을 확장
      img: ['src', 'alt', 'class', 'style'],
      p: ['style'],
      div: ['style'],
      span: ['style'],
      h2: ['style'],
      h3: ['style'],
      ul: ['style'],
      ol: ['style'],
      li: ['style'],
      strong: ['style'],
      em: ['style'],
    },
    allowedClasses: {
      img: ['rich-text-image'],
    },
    allowedStyles: {
      '*': {
        'font-weight': [/^(bold|normal|[1-9]00)$/],
        'font-style': [/^(italic|normal)$/],
        'text-decoration': [/^(underline|none)$/],
        'text-align': [/^(left|center|right|justify)$/],
        width: [/^\d+(\.\d+)?(px|%)$/],
        height: [/^\d+(\.\d+)?(px|%)$/],
        'max-width': [/^\d+(\.\d+)?(px|%)$/],
        // 이미지 정렬(가운데) 및 float 지원
        display: [/^(block|inline|inline-block)$/],
        margin: [/^0 auto$/, /^auto$/],
        'margin-left': [/^auto$/],
        'margin-right': [/^auto$/],
        float: [/^(left|right|none)$/],
      },
    },
    allowedSchemes: ['http', 'https'],
    allowedSchemesAppliedToAttributes: ['src'],
    disallowedTagsMode: 'discard',
  });
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
