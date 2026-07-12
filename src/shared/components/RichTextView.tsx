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
      img: ['src', 'alt', 'class'],
      p: ['style'],
      div: ['style'],
      span: ['style'],
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
