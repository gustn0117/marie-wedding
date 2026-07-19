import sanitizeHtml from 'sanitize-html';

// 리치텍스트(에디터 산출물)를 서버에서 안전하게 정리하는 단일 소스.
// RichTextView 표시와 관리자 메일 발송이 같은 허용목록을 공유해 정책이 갈라지지 않게 한다.
// 허용 태그: 서식(b/i/u/strong/em) · 제목(h2/h3=대/중) · 문단/목록 · 이미지.
export function sanitizeRichHtml(html: string): string {
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
        // 이미지 정렬(가운데) 및 float 지원.
        // 에디터가 넣는 `margin:10px auto`(상하 여백 + 좌우 auto=가운데)를 허용해야
        // 저장/표시 시에도 가운데 정렬이 유지된다. (기존엔 `0 auto`/`auto`만 허용해 통째로 제거됐음)
        display: [/^(block|inline|inline-block)$/],
        margin: [/^\d+(\.\d+)?(px)?\s+auto$/, /^0\s+auto$/, /^auto$/],
        'margin-left': [/^auto$/, /^0(px)?$/],
        'margin-right': [/^auto$/, /^0(px)?$/],
        'margin-top': [/^\d+(\.\d+)?px$/],
        'margin-bottom': [/^\d+(\.\d+)?px$/],
        float: [/^(left|right|none)$/],
      },
    },
    allowedSchemes: ['http', 'https'],
    allowedSchemesAppliedToAttributes: ['src'],
    disallowedTagsMode: 'discard',
  });
}
