/**
 * 마리에 웨딩홀 채용 안내 PDF 생성
 *
 *   node scripts/generate-intro-pdf.mjs
 *
 *   → docs/marketing/마리에-소개.pdf          (상세 2쪽)
 *   → docs/marketing/마리에-소개-1장요약.pdf  (1쪽만 발송할 때)
 *
 * 팩스 출력 원칙
 * - A4, 순수 흑백 중심, 9pt 이상의 본문, 굵은 구획선
 * - 사진·그라데이션·얇은 회색 글자·QR 코드에 의존하지 않음
 * - 1쪽만으로도 제안이 완결되고, 2쪽은 실제 이용 순서와 FAQ를 보충
 * - 서비스 코드에서 확인한 현재 기능과 문구만 사용
 */
import React from 'react';
import {
  Circle,
  Document,
  Font,
  Page,
  Path,
  Rect,
  StyleSheet,
  Svg,
  Text,
  View,
  renderToFile,
} from '@react-pdf/renderer';
import { mkdirSync } from 'node:fs';

const PRETENDARD =
  'https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/packages/pretendard/dist/public/static';

Font.register({
  family: 'Pretendard',
  fonts: [
    { src: `${PRETENDARD}/Pretendard-Regular.otf`, fontWeight: 400 },
    { src: `${PRETENDARD}/Pretendard-Medium.otf`, fontWeight: 500 },
    { src: `${PRETENDARD}/Pretendard-SemiBold.otf`, fontWeight: 600 },
    { src: `${PRETENDARD}/Pretendard-Bold.otf`, fontWeight: 700 },
    { src: `${PRETENDARD}/Pretendard-ExtraBold.otf`, fontWeight: 800 },
  ],
});
Font.registerHyphenationCallback((word) => [word]);

const h = React.createElement;
const INK = '#111111';
const WHITE = '#FFFFFF';
const PAPER = '#FFFFFF';
const SOFT = '#F1F1F1';
const MID = '#6A6A6A';
const A4 = { width: 595.28, height: 841.89 };

const s = StyleSheet.create({
  page: {
    fontFamily: 'Pretendard',
    color: INK,
    backgroundColor: PAPER,
    fontSize: 9.5,
    lineHeight: 1.45,
    display: 'flex',
    flexDirection: 'column',
  },
  pageBody: {
    paddingHorizontal: 38,
    paddingTop: 24,
    flexGrow: 1,
  },

  /* 공통 머리말 */
  masthead: {
    height: 70,
    paddingHorizontal: 38,
    backgroundColor: INK,
    color: WHITE,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  mastheadLight: {
    height: 58,
    paddingHorizontal: 38,
    borderBottomWidth: 2,
    borderBottomColor: INK,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  brandLockup: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  brandWord: {
    fontSize: 22,
    fontWeight: 800,
    letterSpacing: -0.6,
    marginLeft: 10,
    lineHeight: 1,
  },
  mastMeta: {
    alignItems: 'flex-end',
  },
  mastAd: {
    fontSize: 9,
    fontWeight: 800,
    letterSpacing: 1.2,
    lineHeight: 1,
  },
  mastDesc: {
    marginTop: 6,
    fontSize: 7.5,
    fontWeight: 500,
    letterSpacing: 0.5,
    lineHeight: 1,
  },
  pageNo: {
    fontSize: 9,
    fontWeight: 800,
    letterSpacing: 1.1,
  },

  eyebrow: {
    fontSize: 8,
    fontWeight: 800,
    letterSpacing: 1.5,
    marginBottom: 8,
  },
  headline: {
    fontSize: 31,
    fontWeight: 800,
    letterSpacing: -1.05,
    lineHeight: 1.18,
  },
  lead: {
    marginTop: 12,
    width: 456,
    fontSize: 11,
    fontWeight: 500,
    lineHeight: 1.55,
    letterSpacing: -0.15,
  },
  sectionKicker: {
    fontSize: 8,
    fontWeight: 800,
    letterSpacing: 1.3,
    marginBottom: 9,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: 800,
    letterSpacing: -0.25,
    lineHeight: 1.2,
  },

  /* 1쪽 */
  factBar: {
    marginTop: 19,
    height: 48,
    backgroundColor: INK,
    color: WHITE,
    flexDirection: 'row',
    alignItems: 'stretch',
  },
  fact: {
    flex: 1,
    paddingHorizontal: 12,
    justifyContent: 'center',
    borderRightWidth: 0.7,
    borderRightColor: WHITE,
  },
  factLast: {
    flex: 1.22,
    paddingHorizontal: 12,
    justifyContent: 'center',
  },
  factLabel: {
    fontSize: 9,
    fontWeight: 800,
    lineHeight: 1.2,
  },
  factSub: {
    fontSize: 7.3,
    fontWeight: 400,
    marginTop: 4,
    lineHeight: 1.1,
  },
  flowWrap: {
    marginTop: 21,
  },
  flow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  flowCard: {
    flex: 1,
    height: 76,
    borderWidth: 1.3,
    borderColor: INK,
    padding: 9,
  },
  flowN: {
    fontSize: 15,
    fontWeight: 800,
    lineHeight: 1,
  },
  flowTitle: {
    marginTop: 7,
    fontSize: 10.3,
    fontWeight: 800,
    lineHeight: 1.1,
  },
  flowDesc: {
    marginTop: 4,
    fontSize: 7.8,
    fontWeight: 500,
    lineHeight: 1.35,
  },
  flowArrow: {
    width: 25,
    alignItems: 'center',
    justifyContent: 'center',
  },
  benefits: {
    marginTop: 20,
    borderTopWidth: 2.2,
    borderTopColor: INK,
  },
  benefitRow: {
    minHeight: 49,
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 0.9,
    borderBottomColor: INK,
    paddingVertical: 7,
  },
  benefitN: {
    width: 39,
    fontSize: 13,
    fontWeight: 800,
    letterSpacing: 0.4,
  },
  benefitCopy: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  benefitTitle: {
    width: 160,
    fontSize: 10.5,
    fontWeight: 800,
    lineHeight: 1.25,
  },
  benefitDesc: {
    flex: 1,
    paddingLeft: 9,
    fontSize: 8.3,
    fontWeight: 500,
    lineHeight: 1.4,
  },
  rolesWrap: {
    marginTop: 18,
  },
  roleGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 7,
  },
  role: {
    width: '31.9%',
    height: 29,
    marginRight: '2.15%',
    marginBottom: 7,
    borderWidth: 1.1,
    borderColor: INK,
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 9.1,
    fontWeight: 700,
  },
  roleEnd: {
    width: '31.9%',
    height: 29,
    marginBottom: 7,
    borderWidth: 1.1,
    borderColor: INK,
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 9.1,
    fontWeight: 700,
  },

  /* 2쪽 */
  page2Headline: {
    fontSize: 25,
    fontWeight: 800,
    letterSpacing: -0.8,
    lineHeight: 1.2,
  },
  page2Lead: {
    marginTop: 9,
    fontSize: 10.2,
    fontWeight: 500,
    lineHeight: 1.5,
  },
  stepGrid: {
    marginTop: 16,
  },
  stepRow: {
    flexDirection: 'row',
    marginBottom: 9,
  },
  stepCard: {
    width: '49%',
    minHeight: 124,
    borderWidth: 1.25,
    borderColor: INK,
    padding: 11,
  },
  stepCardRight: {
    width: '49%',
    minHeight: 124,
    borderWidth: 1.25,
    borderColor: INK,
    padding: 11,
    marginLeft: '2%',
  },
  stepHead: {
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: INK,
    paddingBottom: 7,
  },
  stepN: {
    width: 32,
    height: 24,
    backgroundColor: INK,
    color: WHITE,
    fontSize: 10.5,
    fontWeight: 800,
    textAlign: 'center',
    paddingTop: 5,
    lineHeight: 1,
  },
  stepTitle: {
    marginLeft: 9,
    fontSize: 11.2,
    fontWeight: 800,
    lineHeight: 1,
  },
  stepIntro: {
    marginTop: 8,
    marginBottom: 5,
    fontSize: 8.2,
    fontWeight: 600,
    lineHeight: 1.35,
  },
  bullet: {
    fontSize: 8,
    fontWeight: 500,
    lineHeight: 1.5,
  },
  dashboard: {
    marginTop: 10,
    borderWidth: 1.25,
    borderColor: INK,
  },
  dashboardHead: {
    height: 31,
    paddingHorizontal: 10,
    backgroundColor: INK,
    color: WHITE,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  dashboardTitle: {
    fontSize: 9,
    fontWeight: 800,
  },
  dashboardExample: {
    fontSize: 7,
    fontWeight: 500,
    letterSpacing: 0.7,
  },
  tabs: {
    height: 28,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 9,
    borderBottomWidth: 0.8,
    borderBottomColor: INK,
  },
  tabActive: {
    backgroundColor: INK,
    color: WHITE,
    fontSize: 7.3,
    fontWeight: 800,
    paddingVertical: 4,
    paddingHorizontal: 8,
    marginRight: 5,
  },
  tab: {
    borderWidth: 0.7,
    borderColor: INK,
    fontSize: 7.3,
    fontWeight: 700,
    paddingVertical: 3.3,
    paddingHorizontal: 7,
    marginRight: 5,
  },
  candidate: {
    height: 31,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    borderBottomWidth: 0.7,
    borderBottomColor: INK,
  },
  candidateLast: {
    height: 31,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
  },
  candidateName: {
    width: 78,
    fontSize: 8.3,
    fontWeight: 800,
  },
  candidateMeta: {
    flex: 1,
    fontSize: 7.6,
    fontWeight: 500,
  },
  status: {
    width: 45,
    borderWidth: 0.8,
    borderColor: INK,
    fontSize: 7.2,
    fontWeight: 800,
    textAlign: 'center',
    paddingVertical: 3,
  },
  faqWrap: {
    marginTop: 12,
  },
  faqRow: {
    marginTop: 7,
    flexDirection: 'row',
    borderTopWidth: 2,
    borderTopColor: INK,
    borderBottomWidth: 1,
    borderBottomColor: INK,
  },
  faq: {
    flex: 1,
    minHeight: 66,
    paddingVertical: 8,
    paddingRight: 10,
    borderRightWidth: 0.8,
    borderRightColor: INK,
  },
  faqMid: {
    flex: 1,
    minHeight: 66,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRightWidth: 0.8,
    borderRightColor: INK,
  },
  faqLast: {
    flex: 1,
    minHeight: 66,
    paddingVertical: 8,
    paddingLeft: 10,
  },
  faqQ: {
    fontSize: 8.4,
    fontWeight: 800,
    lineHeight: 1.25,
  },
  faqA: {
    marginTop: 5,
    fontSize: 7.6,
    fontWeight: 500,
    lineHeight: 1.45,
  },

  /* 공통 CTA/하단 */
  cta: {
    marginHorizontal: 38,
    marginTop: 14,
    minHeight: 58,
    paddingHorizontal: 17,
    backgroundColor: INK,
    color: WHITE,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  ctaSmall: {
    fontSize: 8,
    fontWeight: 700,
    letterSpacing: 0.3,
    lineHeight: 1.2,
  },
  ctaUrl: {
    marginTop: 4,
    fontSize: 20,
    fontWeight: 800,
    letterSpacing: -0.35,
    lineHeight: 1,
  },
  ctaSteps: {
    fontSize: 8,
    fontWeight: 600,
    textAlign: 'right',
    lineHeight: 1.45,
  },
  footer: {
    marginHorizontal: 38,
    paddingTop: 9,
    paddingBottom: 15,
  },
  footerMain: {
    fontSize: 6.9,
    fontWeight: 700,
    lineHeight: 1.4,
  },
  footerSub: {
    marginTop: 2,
    fontSize: 6.6,
    fontWeight: 400,
    lineHeight: 1.4,
    color: MID,
  },
});

function LogoMark({ invert = false }) {
  const square = invert ? WHITE : INK;
  const stroke = invert ? INK : WHITE;
  return h(
    Svg,
    { width: 30, height: 30, viewBox: '0 0 40 40' },
    [
      h(Rect, { key: 'r', width: 40, height: 40, rx: 8, fill: square }),
      h(Path, {
        key: 'p1',
        d: 'M10 28V12.75L20 22.5l10-9.75V28',
        stroke,
        strokeWidth: 3.4,
        strokeLinecap: 'round',
        strokeLinejoin: 'round',
      }),
      h(Path, {
        key: 'p2',
        d: 'M20 22.5V28',
        stroke,
        strokeWidth: 3.4,
        strokeLinecap: 'round',
      }),
      h(Circle, { key: 'c', cx: 29, cy: 9.75, r: 2.1, fill: stroke }),
    ],
  );
}

function Brand({ invert = false }) {
  return h(View, { style: s.brandLockup }, [
    h(LogoMark, { key: 'mark', invert }),
    h(Text, { key: 'word', style: [s.brandWord, invert ? { color: INK } : { color: WHITE }] }, 'Marié'),
  ]);
}

function DarkHeader() {
  return h(View, { style: s.masthead }, [
    h(Brand, { key: 'brand' }),
    h(View, { key: 'meta', style: s.mastMeta }, [
      h(Text, { key: 'ad', style: s.mastAd }, '(광고) · 웨딩홀 채용 안내'),
      h(Text, { key: 'desc', style: s.mastDesc }, '업체 회원용  |  marie.co.kr'),
    ]),
  ]);
}

function LightHeader() {
  return h(View, { style: s.mastheadLight }, [
    h(Brand, { key: 'brand', invert: true }),
    h(Text, { key: 'page', style: s.pageNo }, 'HOW IT WORKS  ·  02'),
  ]);
}

function Footer({ compact = false }) {
  return h(View, { style: s.footer }, [
    h(
      Text,
      { key: 'main', style: s.footerMain },
      '(광고) 발신: 마리에  ·  서비스: marie.co.kr  ·  문의 및 수신거부: admin@marie.co.kr',
    ),
    compact
      ? null
      : h(
        Text,
        { key: 'sub', style: s.footerSub },
        '본 팩스는 웨딩 업계 사업자를 대상으로 한 광고성 정보입니다. 수신을 원하지 않으시면 이 팩스를 받은 번호만 적어 위 이메일로 보내주세요. 확인 즉시 발송 목록에서 제외합니다.',
      ),
  ]);
}

function Cta({ detail = false }) {
  return h(View, { style: s.cta }, [
    h(View, { key: 'left' }, [
      h(Text, { key: 'small', style: s.ctaSmall }, detail ? '채용 공고를 직접 확인해 보세요' : '지금 업체 회원으로 시작하세요'),
      h(Text, { key: 'url', style: s.ctaUrl }, 'marie.co.kr'),
    ]),
    h(
      Text,
      { key: 'steps', style: s.ctaSteps },
      detail
        ? '문의  admin@marie.co.kr\n채용 정보 · 인재/업체 프로필 · 커뮤니티'
        : '회원가입  →  업체 정보 입력  →  공고 등록\n현재 채용 공고 등록·지원 무료',
    ),
  ]);
}

function FlowCard({ n, title, desc }) {
  return h(View, { style: s.flowCard }, [
    h(Text, { key: 'n', style: s.flowN }, n),
    h(Text, { key: 'title', style: s.flowTitle }, title),
    h(Text, { key: 'desc', style: s.flowDesc }, desc),
  ]);
}

function FlowArrow() {
  return h(
    View,
    { style: s.flowArrow },
    h(
      Svg,
      { width: 17, height: 12, viewBox: '0 0 17 12' },
      h(Path, {
        d: 'M1 6h14M10 1l5 5-5 5',
        fill: 'none',
        stroke: INK,
        strokeWidth: 2.2,
        strokeLinecap: 'square',
        strokeLinejoin: 'miter',
      }),
    ),
  );
}

function Benefit({ n, title, desc }) {
  return h(View, { style: s.benefitRow }, [
    h(Text, { key: 'n', style: s.benefitN }, n),
    h(View, { key: 'copy', style: s.benefitCopy }, [
      h(Text, { key: 'title', style: s.benefitTitle }, title),
      h(Text, { key: 'desc', style: s.benefitDesc }, desc),
    ]),
  ]);
}

function Role({ children, end = false }) {
  return h(
    View,
    { style: end ? s.roleEnd : s.role },
    h(Text, { style: { fontSize: 9.1, fontWeight: 700, lineHeight: 1 } }, children),
  );
}

function PageOne() {
  const roles = ['예약실 · 상담', '연회 · 식음', '예식 · 현장 진행', '웨딩플래너', '안내 · 예식 도우미', '주차 · 시설 관리'];
  return h(Page, { size: A4, style: s.page }, [
    h(DarkHeader, { key: 'head' }),
    h(View, { key: 'body', style: s.pageBody }, [
      h(Text, { key: 'eye', style: s.eyebrow }, 'WEDDING RECRUITING · FOR BUSINESS'),
      h(Text, { key: 'h1', style: s.headline }, '필요한 사람을 찾는 일,\n공고 하나로 정리하세요.'),
      h(
        Text,
        { key: 'lead', style: s.lead },
        '예약실 상담부터 연회·현장 진행·주차·시설까지. 마리에는 웨딩 업계의 업체와 구직자가 공고와 이력서로 만나는 전문 채용 플랫폼입니다.',
      ),

      h(View, { key: 'facts', style: s.factBar }, [
        h(View, { key: 'f1', style: s.fact }, [
          h(Text, { key: 't', style: s.factLabel }, '웨딩 업계 특화'),
          h(Text, { key: 'd', style: s.factSub }, '예식장부터 플래너까지'),
        ]),
        h(View, { key: 'f2', style: s.fact }, [
          h(Text, { key: 't', style: s.factLabel }, '공고 등록 현재 무료'),
          h(Text, { key: 'd', style: s.factSub }, '선택형 노출 상품은 별도'),
        ]),
        h(View, { key: 'f3', style: s.factLast }, [
          h(Text, { key: 't', style: s.factLabel }, '지원서·연락처 한곳에서 확인'),
          h(Text, { key: 'd', style: s.factSub }, '접수 상태와 비공개 메모까지'),
        ]),
      ]),

      h(View, { key: 'flowWrap', style: s.flowWrap }, [
        h(Text, { key: 'k', style: s.sectionKicker }, '채용이 이렇게 이어집니다'),
        h(View, { key: 'flow', style: s.flow }, [
          h(FlowCard, {
            key: 'c1',
            n: '01',
            title: '업체가 공고 등록',
            desc: '직무·지역·고용형태·급여·마감일을 입력합니다.',
          }),
          h(FlowArrow, { key: 'a1' }),
          h(FlowCard, {
            key: 'c2',
            n: '02',
            title: '개인 회원이 지원',
            desc: '공고에 맞는 이력서와 연락처를 제출합니다.',
          }),
          h(FlowArrow, { key: 'a2' }),
          h(FlowCard, {
            key: 'c3',
            n: '03',
            title: '지원자를 검토',
            desc: '이력서를 보고 필요한 분께 직접 연락합니다.',
          }),
        ]),
      ]),

      h(View, { key: 'benefits', style: s.benefits }, [
        h(Benefit, {
          key: 'b1',
          n: '01',
          title: '공고가 읽기 쉬워집니다',
          desc: '담당 업무·지원 자격·근무 조건을 항목별로 정리해 구직자가 핵심을 빠르게 확인합니다.',
        }),
        h(Benefit, {
          key: 'b2',
          n: '02',
          title: '지원자 비교가 쉬워집니다',
          desc: '지원 시점의 이력서·연락처·지원 한마디를 같은 화면에서 확인할 수 있습니다.',
        }),
        h(Benefit, {
          key: 'b3',
          n: '03',
          title: '채용 진행을 놓치지 않습니다',
          desc: '접수·검토 중·승인·거절로 분류하고 지원자마다 채용 담당자 전용 메모를 남깁니다.',
        }),
      ]),

      h(View, { key: 'roles', style: s.rolesWrap }, [
        h(Text, { key: 'title', style: s.sectionTitle }, '이런 자리부터 올려보세요'),
        h(
          View,
          { key: 'grid', style: s.roleGrid },
          roles.map((role, index) =>
            h(Role, { key: role, end: index % 3 === 2 }, role),
          ),
        ),
      ]),
    ]),
    h(Cta, { key: 'cta' }),
    h(Footer, { key: 'foot' }),
  ]);
}

function StepCard({ n, title, intro, bullets, right = false }) {
  return h(View, { style: right ? s.stepCardRight : s.stepCard }, [
    h(View, { key: 'head', style: s.stepHead }, [
      h(Text, { key: 'n', style: s.stepN }, n),
      h(Text, { key: 'title', style: s.stepTitle }, title),
    ]),
    h(Text, { key: 'intro', style: s.stepIntro }, intro),
    ...bullets.map((bullet) => h(Text, { key: bullet, style: s.bullet }, `•  ${bullet}`)),
  ]);
}

function Candidate({ name, meta, status, last = false }) {
  return h(View, { style: last ? s.candidateLast : s.candidate }, [
    h(Text, { key: 'name', style: s.candidateName }, name),
    h(Text, { key: 'meta', style: s.candidateMeta }, meta),
    h(Text, { key: 'status', style: s.status }, status),
  ]);
}

function Faq({ q, a, position }) {
  const style = position === 'last' ? s.faqLast : position === 'mid' ? s.faqMid : s.faq;
  return h(View, { style }, [
    h(Text, { key: 'q', style: s.faqQ }, `Q. ${q}`),
    h(Text, { key: 'a', style: s.faqA }, a),
  ]);
}

function PageTwo() {
  return h(Page, { size: A4, style: s.page }, [
    h(LightHeader, { key: 'head' }),
    h(View, { key: 'body', style: [s.pageBody, { paddingTop: 20 }] }, [
      h(Text, { key: 'eye', style: s.eyebrow }, '가입부터 지원자 검토까지'),
      h(Text, { key: 'h1', style: s.page2Headline }, '처음이어도 어렵지 않습니다.'),
      h(
        Text,
        { key: 'lead', style: s.page2Lead },
        '업체 회원 기준 실제 이용 순서를 4단계로 정리했습니다. 필요한 정보만 준비하면 공고 작성부터 지원자 관리까지 한 흐름으로 이어집니다.',
      ),

      h(View, { key: 'steps', style: s.stepGrid }, [
        h(View, { key: 'row1', style: s.stepRow }, [
          h(StepCard, {
            key: 's1',
            n: '01',
            title: '업체 프로필 준비',
            intro: '공고 등록 전 핵심 4가지만 먼저 채웁니다.',
            bullets: [
              '업체명 · 업종',
              '활동 지역 · 연락처',
              '소개 · 사진 · 갤러리는 선택 사항',
            ],
          }),
          h(StepCard, {
            key: 's2',
            n: '02',
            title: '채용 공고 작성',
            intro: '구직자가 궁금해할 조건을 항목별로 적습니다.',
            bullets: [
              '제목 · 업종 · 고용형태 · 지역',
              '급여 · 최소 경력 · 마감일',
              '담당 업무 · 지원 자격 · 근무 조건',
              '대표 사진 · 추가 사진은 선택 사항',
            ],
            right: true,
          }),
        ]),
        h(View, { key: 'row2', style: s.stepRow }, [
          h(StepCard, {
            key: 's3',
            n: '03',
            title: '이력서로 지원 접수',
            intro: '개인 회원이 공고에 맞는 이력서를 골라 지원합니다.',
            bullets: [
              '이력서 · 연락처 · 지원 한마디 제출',
              '지원 시점의 이력서 내용이 제출본으로 보관',
              '개인 회원은 이력서를 최대 5개까지 관리',
            ],
          }),
          h(StepCard, {
            key: 's4',
            n: '04',
            title: '지원자 검토 및 연락',
            intro: '공고별 지원자를 상태에 따라 정리합니다.',
            bullets: [
              '접수 · 검토 중 · 승인 · 거절',
              '제출 이력서와 연락처 확인',
              '지원자별 비공개 메모',
              '적합한 지원자에게 업체가 직접 연락',
            ],
            right: true,
          }),
        ]),
      ]),

      h(View, { key: 'dashboard', style: s.dashboard }, [
        h(View, { key: 'head', style: s.dashboardHead }, [
          h(Text, { key: 'title', style: s.dashboardTitle }, '지원자 관리 화면 구성'),
          h(Text, { key: 'ex', style: s.dashboardExample }, '화면 이해를 위한 예시'),
        ]),
        h(View, { key: 'tabs', style: s.tabs }, [
          h(Text, { key: 'all', style: s.tabActive }, '전체'),
          h(Text, { key: 'new', style: s.tab }, '접수'),
          h(Text, { key: 'review', style: s.tab }, '검토 중'),
          h(Text, { key: 'ok', style: s.tab }, '승인'),
          h(Text, { key: 'no', style: s.tab }, '거절'),
        ]),
        h(Candidate, { key: 'c1', name: '지원자 A', meta: '제출 이력서 · 연락처 · 지원 한마디', status: '접수' }),
        h(Candidate, { key: 'c2', name: '지원자 B', meta: '제출 이력서 · 연락처 · 비공개 메모', status: '검토 중' }),
        h(Candidate, { key: 'c3', name: '지원자 C', meta: '제출 이력서 · 연락처 · 진행 상태', status: '승인', last: true }),
      ]),

      h(View, { key: 'faq', style: s.faqWrap }, [
        h(Text, { key: 'title', style: s.sectionTitle }, '자주 묻는 질문'),
        h(View, { key: 'row', style: s.faqRow }, [
          h(Faq, {
            key: 'f1',
            q: '이용료가 있나요?',
            a: '현재 채용 공고 등록과 지원은 무료입니다. 상단 노출·광고 등 선택형 유료 상품은 별도입니다.',
            position: 'first',
          }),
          h(Faq, {
            key: 'f2',
            q: '누가 공고를 올리나요?',
            a: '업체 회원이 공고를 등록하고, 개인 회원이 등록한 이력서로 지원합니다.',
            position: 'mid',
          }),
          h(Faq, {
            key: 'f3',
            q: '어떤 업종이 있나요?',
            a: '예식장·드레스·스튜디오·메이크업·플래너·도우미·사회자·축가 등을 다룹니다.',
            position: 'last',
          }),
        ]),
      ]),
    ]),
    h(Cta, { key: 'cta', detail: true }),
    h(Footer, { key: 'foot', compact: true }),
  ]);
}

const fullDocument = h(
  Document,
  {
    title: '마리에 웨딩홀 채용 안내',
    author: 'Marié',
    subject: '웨딩 업계 전문 채용 플랫폼 안내',
    keywords: '마리에, 웨딩홀 채용, 웨딩 구인구직, 예약실 채용',
    language: 'ko-KR',
  },
  [h(PageOne, { key: 'p1' }), h(PageTwo, { key: 'p2' })],
);

const summaryDocument = h(
  Document,
  {
    title: '마리에 웨딩홀 채용 안내 — 1장 요약',
    author: 'Marié',
    subject: '웨딩 업계 전문 채용 플랫폼 1장 안내',
    keywords: '마리에, 웨딩홀 채용, 웨딩 구인구직',
    language: 'ko-KR',
  },
  h(PageOne),
);

mkdirSync('docs/marketing', { recursive: true });
await renderToFile(fullDocument, 'docs/marketing/마리에-소개.pdf');
await renderToFile(summaryDocument, 'docs/marketing/마리에-소개-1장요약.pdf');

console.log('생성 완료: docs/marketing/마리에-소개.pdf (2쪽)');
console.log('생성 완료: docs/marketing/마리에-소개-1장요약.pdf (1쪽)');
