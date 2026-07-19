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

// 관리자가 '완성된 HTML 템플릿/뉴스레터'를 직접 붙여넣어 발송하는 소스 모드 전용.
// 표(table)·링크·인라인 색상/여백 등 이메일에서 흔한 태그를 넓게 허용하되,
// <script>·<iframe>·이벤트핸들러(on*)·javascript: 스킴은 계속 제거한다.
// RichTextView(사내 콘텐츠 표시)와 절대 공유하지 않는다 — 표시용은 좁게 유지.
export function sanitizeEmailHtml(html: string): string {
  if (!html) return '';
  return sanitizeHtml(html, {
    allowedTags: [
      'a', 'b', 'blockquote', 'br', 'caption', 'center', 'code', 'col', 'colgroup',
      'div', 'em', 'figure', 'figcaption', 'font', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
      'hr', 'i', 'img', 'label', 'li', 'ol', 'p', 'pre', 's', 'small', 'span',
      'strike', 'strong', 'style', 'sub', 'sup', 'table', 'tbody', 'td', 'tfoot',
      'th', 'thead', 'tr', 'u', 'ul',
    ],
    allowedAttributes: {
      a: ['href', 'name', 'target', 'rel', 'style', 'title', 'class'],
      img: ['src', 'alt', 'title', 'width', 'height', 'style', 'class', 'align', 'border'],
      font: ['color', 'face', 'size', 'style'],
      // 표 기반 레이아웃 속성을 폭넓게 허용
      '*': ['style', 'align', 'valign', 'class', 'width', 'height', 'bgcolor',
        'background', 'colspan', 'rowspan', 'border', 'cellpadding', 'cellspacing', 'dir'],
    },
    // allowedStyles 미지정 = 인라인 스타일 전부 통과(색/배경/여백/폰트 등). 스크립트 실행 벡터 아님.
    allowedSchemesByTag: {
      a: ['http', 'https', 'mailto', 'tel'],
      img: ['http', 'https', 'data'],
    },
    allowedSchemesAppliedToAttributes: ['href', 'src', 'background'],
    // <style> 블록 허용(반응형 미디어쿼리 등 템플릿 충실도). sanitize-html 은 <style> 내부
    // CSS 를 정리하지 않아 '취약 태그'로 경고하지만, 여기선 (1) 작성자가 비밀번호 관리자(신뢰),
    // (2) 보낸편지함 미리보기는 스크립트 불가 sandbox iframe 렌더, (3) 수신 측 메일 클라이언트가
    // CSS 를 재차 정리 → 스크립트 실행 경로가 없어 허용한다. 경고만 끈다.
    allowVulnerableTags: true,
    // 위험 태그는 태그+내용 모두 제거(script 등은 기본 nonTextTags 로 텍스트도 버려짐).
    disallowedTagsMode: 'discard',
  });
}
