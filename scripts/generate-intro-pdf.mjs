/**
 * 마리에 소개 PDF 생성 (팩스 발송용)
 *
 *   node scripts/generate-intro-pdf.mjs
 *   → docs/marketing/마리에-소개.pdf
 *
 * 팩스 제약에 맞춘 설계:
 *  - 팩스는 1비트 흑백에 세로 해상도가 낮다. 회색조·얇은 선·사진은 뭉개지거나 사라진다.
 *    그래서 순수 검정/흰색만 쓰고, 구분선은 1.5pt 이상, 본문은 11pt 이상으로 잡는다.
 *  - 이모지·아이콘 폰트는 팩스에서 깨지므로 쓰지 않는다.
 *  - 수치·실적은 넣지 않는다(사실이 아닌 숫자를 외부에 보내면 안 된다).
 *  - 광고성 팩스 표기 의무: 맨 위 (광고), 맨 아래 발신자 정보와 수신거부 안내.
 */
import React from 'react';
import { Document, Page, Text, View, StyleSheet, Font, renderToFile } from '@react-pdf/renderer';
import { mkdirSync } from 'node:fs';

const FONT_BASE =
  'https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/packages/pretendard/dist/public/static';

Font.register({
  family: 'Pretendard',
  fonts: [
    { src: `${FONT_BASE}/Pretendard-Regular.otf`, fontWeight: 400 },
    { src: `${FONT_BASE}/Pretendard-Medium.otf`, fontWeight: 500 },
    { src: `${FONT_BASE}/Pretendard-Bold.otf`, fontWeight: 700 },
    { src: `${FONT_BASE}/Pretendard-ExtraBold.otf`, fontWeight: 800 },
  ],
});
// 한글은 어절 단위로 끊어야 읽기 좋다.
Font.registerHyphenationCallback((word) => [word]);

const BLACK = '#000000';

const s = StyleSheet.create({
  page: {
    fontFamily: 'Pretendard',
    color: BLACK,
    backgroundColor: '#FFFFFF',
    paddingTop: 30,
    paddingBottom: 24,
    paddingHorizontal: 46,
    fontSize: 11.5,
    lineHeight: 1.55,
  },

  adMark: { fontSize: 10.5, fontWeight: 700, marginBottom: 10 },

  // 머리말 — 이름과 한 줄 정의만. 첫눈에 '무엇을 하는 곳'인지 읽히게 한다.
  // 큰 글자는 페이지 기본 lineHeight(1.55)를 그대로 쓰면 다음 줄과 겹친다 — 개별 지정.
  brand: { fontSize: 36, fontWeight: 800, letterSpacing: -1, lineHeight: 1.15 },
  tagline: { fontSize: 15, fontWeight: 700, marginTop: 9, lineHeight: 1.3 },
  subTagline: { fontSize: 11.5, marginTop: 7, lineHeight: 1.6 },
  rule: { borderBottomWidth: 2, borderBottomColor: BLACK, marginTop: 13, marginBottom: 15 },
  thinRule: { borderBottomWidth: 1, borderBottomColor: BLACK, marginTop: 12, marginBottom: 12 },

  sectionTitle: { fontSize: 13.5, fontWeight: 800, marginBottom: 8 },

  // 번호 목록 — 아이콘 대신 숫자를 쓴다(팩스에서 확실히 보인다).
  item: { flexDirection: 'row', marginBottom: 8.5 },
  // 숫자에도 lineHeight 를 1로 고정한다. 기본 1.55 면 글자 높이가 상자를 넘어 잘려 사라진다.
  itemNum: {
    width: 20, height: 20, marginRight: 11, marginTop: 1,
    backgroundColor: BLACK, color: '#FFFFFF',
    fontSize: 12, fontWeight: 800, textAlign: 'center',
    lineHeight: 1, paddingTop: 4.5,
  },
  itemBody: { flex: 1 },
  itemTitle: { fontSize: 12, fontWeight: 700, marginBottom: 2 },
  itemDesc: { fontSize: 11, lineHeight: 1.5 },

  // 대상 업종 — 굵은 테두리 박스
  box: { borderWidth: 1.5, borderColor: BLACK, paddingVertical: 10, paddingHorizontal: 14, marginBottom: 14 },
  boxLabel: { fontSize: 10.5, fontWeight: 700, marginBottom: 5 },
  boxText: { fontSize: 11.5, fontWeight: 500, lineHeight: 1.5 },

  steps: { flexDirection: 'row', marginBottom: 4 },
  step: { flex: 1, paddingRight: 12 },
  stepNum: { fontSize: 10, fontWeight: 800, marginBottom: 3 },
  stepTitle: { fontSize: 11.5, fontWeight: 700, marginBottom: 2 },
  stepDesc: { fontSize: 10.5, lineHeight: 1.45 },

  // 연락처 — 검정 바탕에 흰 글씨. 팩스에서 가장 확실하게 살아남는 강조 방식.
  contact: { backgroundColor: BLACK, paddingVertical: 13, paddingHorizontal: 18, marginTop: 2 },
  contactLabel: { color: '#FFFFFF', fontSize: 10, fontWeight: 700, marginBottom: 6 },
  contactUrl: { color: '#FFFFFF', fontSize: 20, fontWeight: 800, marginBottom: 5 },
  contactLine: { color: '#FFFFFF', fontSize: 11, fontWeight: 500 },

  footer: { marginTop: 11, fontSize: 8.6, lineHeight: 1.45 },
});

function Item({ n, title, desc }) {
  return React.createElement(View, { style: s.item }, [
    React.createElement(Text, { style: s.itemNum, key: 'n' }, String(n)),
    React.createElement(View, { style: s.itemBody, key: 'b' }, [
      React.createElement(Text, { style: s.itemTitle, key: 't' }, title),
      React.createElement(Text, { style: s.itemDesc, key: 'd' }, desc),
    ]),
  ]);
}

function Step({ n, title, desc }) {
  return React.createElement(View, { style: s.step }, [
    React.createElement(Text, { style: s.stepNum, key: 'n' }, `STEP ${n}`),
    React.createElement(Text, { style: s.stepTitle, key: 't' }, title),
    React.createElement(Text, { style: s.stepDesc, key: 'd' }, desc),
  ]);
}

const doc = React.createElement(
  Document,
  { title: '마리에 소개', author: 'Marié' },
  React.createElement(Page, { size: 'A4', style: s.page }, [
    React.createElement(Text, { style: s.adMark, key: 'ad' }, '(광고)'),

    React.createElement(Text, { style: s.brand, key: 'brand' }, '마리에'),
    React.createElement(Text, { style: s.tagline, key: 'tag' }, '웨딩 업계 전문 구인구직 플랫폼'),
    React.createElement(
      Text,
      { style: s.subTagline, key: 'sub' },
      '웨딩홀, 드레스샵, 스튜디오, 메이크업샵, 플래너, 예식 도우미.\n'
      + '웨딩 업계에서 일하는 사람과 사람을 찾는 업체가 모이는 곳입니다.',
    ),
    React.createElement(View, { style: s.rule, key: 'r1' }),

    React.createElement(View, { style: s.box, key: 'box' }, [
      React.createElement(Text, { style: s.boxLabel, key: 'l' }, '이런 업종을 위한 서비스입니다'),
      React.createElement(
        Text,
        { style: s.boxText, key: 't' },
        '웨딩홀 · 예식장   |   드레스샵   |   스튜디오   |   메이크업샵   |   웨딩플래너',
      ),
    ]),

    React.createElement(Text, { style: s.sectionTitle, key: 'st1' }, '웨딩홀에서 이렇게 쓰십니다'),
    React.createElement(Item, {
      key: 'i1', n: 1,
      title: '채용 공고를 무료로 올립니다',
      desc: '예약실, 연회, 현장 진행, 상담 등 필요한 자리를 직접 등록합니다. 등록 비용은 없습니다.',
    }),
    React.createElement(Item, {
      key: 'i2', n: 2,
      title: '업계 경력자에게 바로 보입니다',
      desc: '웨딩 업계 채용만 다루기 때문에, 일반 구인 사이트보다 관련 없는 지원이 적습니다.',
    }),
    React.createElement(Item, {
      key: 'i3', n: 3,
      title: '지원자 이력서를 온라인으로 확인합니다',
      desc: '경력과 자격을 화면에서 바로 보고, 필요한 사람에게만 연락하시면 됩니다.',
    }),
    React.createElement(Item, {
      key: 'i4', n: 4,
      title: '업체 프로필로 홀을 알립니다',
      desc: '홀 사진과 소개를 올려두면 구직자가 먼저 찾아옵니다.',
    }),

    React.createElement(View, { style: s.thinRule, key: 'r2' }),

    React.createElement(Text, { style: s.sectionTitle, key: 'st2' }, '시작하는 방법'),
    React.createElement(View, { style: s.steps, key: 'steps' }, [
      React.createElement(Step, { key: 's1', n: 1, title: '가입', desc: '홈페이지에서 업체 회원으로 가입합니다.' }),
      React.createElement(Step, { key: 's2', n: 2, title: '공고 등록', desc: '필요한 자리와 조건을 적습니다.' }),
      React.createElement(Step, { key: 's3', n: 3, title: '지원자 확인', desc: '지원이 들어오면 이력서를 봅니다.' }),
    ]),

    React.createElement(View, { style: s.contact, key: 'contact' }, [
      React.createElement(Text, { style: s.contactLabel, key: 'l' }, '지금 바로 확인해 보세요'),
      React.createElement(Text, { style: s.contactUrl, key: 'u' }, 'marie.co.kr'),
      React.createElement(Text, { style: s.contactLine, key: 'e' }, '문의  admin@marie.co.kr'),
    ]),

    React.createElement(
      Text,
      { style: s.footer, key: 'footer' },
      '본 팩스는 웨딩 업계 사업자를 대상으로 한 광고성 정보입니다.\n'
      + '발신: 마리에 (marie.co.kr)   |   문의 및 수신거부: admin@marie.co.kr\n'
      + '수신을 원하지 않으시면 위 주소로 팩스번호를 알려주시면 즉시 발송을 중단하고 다시 보내지 않습니다.',
    ),
  ]),
);

mkdirSync('docs/marketing', { recursive: true });
const out = 'docs/marketing/마리에-소개.pdf';
await renderToFile(doc, out);
console.log(`생성 완료: ${out}`);
