/**
 * 마리에 소개 PDF 생성 (팩스 발송용)
 *
 *   node scripts/generate-intro-pdf.mjs
 *   → docs/marketing/마리에-소개.pdf
 *
 * ── 디자인 방향 ──────────────────────────────────────────────────────────
 * 팩스로 도착하는 종이의 본래 성격은 '안내문'이다. 그리고 한국 격식 인쇄물
 * (청첩장·예식 안내)의 글자는 명조체다. 그래서 큰 글은 명조(NanumMyeongjo),
 * 실무 정보는 고딕(Pretendard)으로 나눠 격식과 실무를 대비시킨다.
 *
 * 팩스 제약이 곧 디자인 규칙:
 *  - 1비트 흑백 + 낮은 세로 해상도. 회색·얇은 선·사진·이모지는 뭉개진다 → 쓰지 않는다.
 *  - 큰 면적의 흑백 반전은 가장 확실하게 살아남는다 → 강조는 검정 띠로만 준다.
 *  - 명조는 획이 가늘어 작은 크기에서 깨진다 → 20pt 이상 큰 글에만 쓴다.
 *  - 장당 과금이므로 A4 한 장을 넘기지 않는다.
 *
 * 문구는 확인 가능한 사실만 쓴다(회원수·실적 등 수치 금지).
 * 광고성 팩스 표기 의무: 상단 (광고), 하단 발신자 정보와 수신거부 안내.
 */
import React from 'react';
import { Document, Page, Text, View, StyleSheet, Font, renderToFile } from '@react-pdf/renderer';
import { mkdirSync } from 'node:fs';

const PRETENDARD = 'https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/packages/pretendard/dist/public/static';
// 본명조(Noto Serif KR). 나눔명조는 fontkit 이 파싱하지 못해 렌더가 죽는다 — 쓰지 말 것.
const MYEONGJO = 'https://fonts.gstatic.com/s/notoserifkr/v31';

Font.register({
  family: 'Pretendard',
  fonts: [
    { src: `${PRETENDARD}/Pretendard-Regular.otf`, fontWeight: 400 },
    { src: `${PRETENDARD}/Pretendard-Medium.otf`, fontWeight: 500 },
    { src: `${PRETENDARD}/Pretendard-SemiBold.otf`, fontWeight: 600 },
    { src: `${PRETENDARD}/Pretendard-Bold.otf`, fontWeight: 700 },
  ],
});
Font.register({
  family: 'Myeongjo',
  fonts: [
    { src: `${MYEONGJO}/3JnoSDn90Gmq2mr3blnHaTZXbOtLJDvui3JOncgBf852.ttf`, fontWeight: 700 },
    { src: `${MYEONGJO}/3JnoSDn90Gmq2mr3blnHaTZXbOtLJDvui3JOnchPf852.ttf`, fontWeight: 900 },
  ],
});
Font.registerHyphenationCallback((word) => [word]); // 한글은 어절 단위로 끊는다

const BLACK = '#000000';
const WHITE = '#FFFFFF';

const s = StyleSheet.create({
  page: {
    fontFamily: 'Pretendard',
    color: BLACK,
    backgroundColor: WHITE,
    fontSize: 10.5,
    lineHeight: 1.5,
    paddingBottom: 26,
    // 세로 플렉스 + 신축 여백으로 맺음부를 지면 바닥에 붙인다.
    // (안 하면 내용이 위쪽에만 몰려 아래가 텅 빈 미완성 지면처럼 보인다)
    display: 'flex',
    flexDirection: 'column',
  },
  spacer: { flexGrow: 1, minHeight: 0 },

  // ── 머리 띠: 전면 검정. 팩스에서 가장 먼저, 가장 확실하게 읽히는 자리.
  masthead: {
    backgroundColor: BLACK,
    paddingTop: 17,
    paddingBottom: 16,
    paddingHorizontal: 44,
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
  },
  mastheadBrand: { fontFamily: 'Myeongjo', fontWeight: 900, fontSize: 27, color: WHITE, lineHeight: 1 },
  mastheadMeta: { fontSize: 8.5, fontWeight: 700, color: WHITE, letterSpacing: 1.6, lineHeight: 1 },

  body: { paddingHorizontal: 44 },

  // ── 표제: 이 종이가 무엇인지 3초 안에 말하는 자리.
  headline: {
    fontFamily: 'Myeongjo', fontWeight: 900,
    fontSize: 29, lineHeight: 1.32, marginTop: 24, letterSpacing: -0.4,
  },
  headlineSub: { fontSize: 10.8, lineHeight: 1.55, marginTop: 11, maxWidth: 400 },

  ruleThick: { borderBottomWidth: 2.5, borderBottomColor: BLACK, marginTop: 22 },

  // ── 정의 목록: 실장이 실제로 궁금해하는 세 가지(무엇/누가/얼마)를 세로줄로 묶는다.
  defRow: { flexDirection: 'row', borderBottomWidth: 0.9, borderBottomColor: BLACK, paddingVertical: 10 },
  defLabelBox: { width: 74, borderRightWidth: 2.5, borderRightColor: BLACK, paddingRight: 12 },
  defLabel: { fontFamily: 'Myeongjo', fontWeight: 700, fontSize: 14, lineHeight: 1.1 },
  defBody: { flex: 1, paddingLeft: 16, justifyContent: 'center' },
  defText: { fontSize: 10.8, lineHeight: 1.55 },
  defStrong: { fontSize: 11.5, fontWeight: 700 },

  // ── 직무 예시: 지면의 남는 공간을 여백으로 두지 않고, 실장이 바로 확인하고 싶어하는
  //    '내 홀 자리도 되나' 를 답한다.
  rolesWrap: { marginTop: 20 },
  rolesLabel: { fontSize: 8.5, fontWeight: 700, letterSpacing: 1.6, marginBottom: 10 },
  rolesRow: { flexDirection: 'row', flexWrap: 'wrap' },
  roleChip: {
    borderWidth: 1.2, borderColor: BLACK,
    paddingVertical: 6, paddingHorizontal: 12,
    marginRight: 7, marginBottom: 7,
    fontSize: 10.5, fontWeight: 600, lineHeight: 1,
  },

  // ── 순서: 실제로 순서가 있는 내용이라 번호를 쓴다.
  stepsTitle: { fontFamily: 'Myeongjo', fontWeight: 700, fontSize: 15, marginTop: 22, marginBottom: 12 },
  steps: { flexDirection: 'row' },
  step: { flex: 1, paddingRight: 16 },
  stepN: { fontFamily: 'Myeongjo', fontWeight: 700, fontSize: 20, lineHeight: 1, marginBottom: 9 },
  stepTitle: { fontSize: 11.5, fontWeight: 700, marginBottom: 3 },
  stepDesc: { fontSize: 10, lineHeight: 1.45 },

  // ── 맺음: 주소 하나만 크게. 검정 띠 위 흰 글씨가 팩스에서 가장 오래 살아남는다.
  cta: {
    backgroundColor: BLACK, marginTop: 22,
    paddingVertical: 18, paddingHorizontal: 44,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
  },
  ctaUrl: { fontFamily: 'Myeongjo', fontWeight: 900, fontSize: 30, color: WHITE, lineHeight: 1 },
  ctaRight: { alignItems: 'flex-end' },
  ctaLabel: { fontSize: 8.5, fontWeight: 700, color: WHITE, letterSpacing: 1.4, marginBottom: 5, lineHeight: 1 },
  ctaMail: { fontSize: 11, fontWeight: 500, color: WHITE, lineHeight: 1 },

  footer: { paddingHorizontal: 44, marginTop: 14, fontSize: 8.2, lineHeight: 1.5 },
});

const el = React.createElement;

function Def({ label, children }) {
  return el(View, { style: s.defRow }, [
    el(View, { style: s.defLabelBox, key: 'l' }, el(Text, { style: s.defLabel }, label)),
    el(View, { style: s.defBody, key: 'b' }, children),
  ]);
}

function Step({ n, title, desc }) {
  return el(View, { style: s.step }, [
    el(Text, { style: s.stepN, key: 'n' }, n),
    el(Text, { style: s.stepTitle, key: 't' }, title),
    el(Text, { style: s.stepDesc, key: 'd' }, desc),
  ]);
}

const doc = el(
  Document,
  { title: '마리에 소개', author: 'Marié', subject: '웨딩 업계 전문 구인구직 플랫폼' },
  el(Page, { size: 'A4', style: s.page }, [
    el(View, { style: s.masthead, key: 'mast' }, [
      el(Text, { style: s.mastheadBrand, key: 'b' }, '마리에'),
      el(Text, { style: s.mastheadMeta, key: 'm' }, '(광고)  웨딩 업계 채용 안내'),
    ]),

    el(View, { style: s.body, key: 'body' }, [
      el(Text, { style: s.headline, key: 'h' }, '웨딩홀 채용,\n웨딩 사람만 오는 곳에서.'),
      el(
        Text,
        { style: s.headlineSub, key: 'hs' },
        '예약실, 연회, 현장 진행, 상담. 홀에서 필요한 자리를 직접 올리고,'
        + ' 웨딩 일을 찾는 사람에게 바로 보여주는 채용 플랫폼입니다.',
      ),

      el(View, { style: s.ruleThick, key: 'r' }),

      el(Def, { key: 'd1', label: '무엇' }, [
        el(Text, { style: s.defStrong, key: 'a' }, '웨딩 업계만 다루는 구인구직 플랫폼'),
        el(Text, { style: s.defText, key: 'b' }, '업계 채용만 취급해, 관련 없는 지원으로 시간을 쓰지 않으셔도 됩니다.'),
      ]),
      el(Def, { key: 'd2', label: '누가' }, [
        el(Text, { style: s.defStrong, key: 'a' }, '웨딩홀 · 드레스샵 · 스튜디오 · 메이크업샵 · 플래너'),
        el(Text, { style: s.defText, key: 'b' }, '업체와 구직자가 같은 곳에서 만납니다.'),
      ]),
      el(Def, { key: 'd3', label: '얼마' }, [
        el(Text, { style: s.defStrong, key: 'a' }, '공고 등록과 지원자 열람 모두 무료'),
        el(Text, { style: s.defText, key: 'b' }, '별도 광고비나 성사 수수료가 없습니다.'),
      ]),

      el(View, { style: s.rolesWrap, key: 'roles' }, [
        el(Text, { style: s.rolesLabel, key: 'l' }, '올리실 수 있는 자리'),
        el(View, { style: s.rolesRow, key: 'r' },
          // 한 줄에 떨어지도록 여섯 개까지만 — 하나가 다음 줄에 혼자 남으면 지면이 흐트러진다.
          ['예약 상담', '연회 서비스', '현장 진행', '웨딩플래너', '예식 도우미', '주차 · 시설']
            .map((r) => el(Text, { style: s.roleChip, key: r }, r))),
      ]),

      el(Text, { style: s.stepsTitle, key: 'sT' }, '시작하는 순서'),
      el(View, { style: s.steps, key: 'steps' }, [
        el(Step, { key: 's1', n: '一', title: '업체 회원 가입', desc: '홈페이지에서 홀 정보를 등록합니다.' }),
        el(Step, { key: 's2', n: '二', title: '공고 등록', desc: '필요한 자리와 근무 조건을 적습니다.' }),
        el(Step, { key: 's3', n: '三', title: '지원자 확인', desc: '이력서를 보고 필요한 분께만 연락합니다.' }),
      ]),
    ]),

    el(View, { style: s.spacer, key: 'sp' }),

    el(View, { style: s.cta, key: 'cta' }, [
      el(Text, { style: s.ctaUrl, key: 'u' }, 'marie.co.kr'),
      el(View, { style: s.ctaRight, key: 'r' }, [
        el(Text, { style: s.ctaLabel, key: 'l' }, '문의'),
        el(Text, { style: s.ctaMail, key: 'm' }, 'admin@marie.co.kr'),
      ]),
    ]),

    el(
      Text,
      { style: s.footer, key: 'f' },
      '본 팩스는 웨딩 업계 사업자를 대상으로 한 광고성 정보입니다.  '
      + '발신 마리에 (marie.co.kr)  ·  문의 및 수신거부 admin@marie.co.kr\n'
      + '수신을 원하지 않으시면 위 주소로 팩스번호를 알려주십시오. 즉시 발송을 중단하고 다시 보내지 않습니다.',
    ),
  ]),
);

mkdirSync('docs/marketing', { recursive: true });
const out = 'docs/marketing/마리에-소개.pdf';
await renderToFile(doc, out);
console.log(`생성 완료: ${out}`);
