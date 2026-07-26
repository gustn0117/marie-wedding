/**
 * 마리에 웨딩홀 채용 안내 PDF 생성
 *
 *   node scripts/generate-intro-pdf.mjs
 *
 *   → docs/marketing/마리에-소개.pdf          (상세 2쪽)
 *   → docs/marketing/마리에-소개-1장요약.pdf  (1쪽 요약)
 *
 * 디자인 방향
 * - 채용 전단지보다 웨딩 브랜드 브로슈어에 가까운 밝은 편집 디자인
 * - 아이보리 지면 + 딥네이비 본문 + 샴페인 골드 장식
 * - 아치 모티프, 넉넉한 행간, 열린 구획으로 우아하고 부드러운 인상
 * - 핵심 정보는 모두 진한 네이비로 표현해 흑백 팩스에서도 남도록 설계
 */
import React from 'react';
import {
  Circle,
  Document,
  Font,
  Image,
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
import { resolve } from 'node:path';

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
const NAVY = '#132238';
const NAVY_2 = '#25364F';
const GOLD = '#B78A4B';
const GOLD_LIGHT = '#D8C19D';
const IVORY = '#FBF8F1';
const WHITE = '#FFFFFF';
const MIST = '#F0F1F2';
const MUTED = '#667084';
const A4 = { width: 595.28, height: 841.89 };
const HERO_ARTWORK = resolve('docs/marketing/assets/wedding-hall-line-art.png');

const s = StyleSheet.create({
  page: {
    fontFamily: 'Pretendard',
    backgroundColor: IVORY,
    color: NAVY,
    fontSize: 9.3,
    lineHeight: 1.45,
    display: 'flex',
    flexDirection: 'column',
  },
  body: {
    paddingHorizontal: 42,
    paddingTop: 22,
    flexGrow: 1,
  },

  /* 머리말 */
  header: {
    height: 58,
    marginHorizontal: 42,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 0.9,
    borderBottomColor: GOLD,
  },
  brand: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  brandWord: {
    marginLeft: 9,
    fontSize: 20,
    fontWeight: 800,
    letterSpacing: -0.55,
    lineHeight: 1,
  },
  headerMeta: {
    alignItems: 'flex-end',
  },
  adLabel: {
    fontSize: 8.2,
    fontWeight: 800,
    letterSpacing: 0.6,
    lineHeight: 1,
  },
  headerSub: {
    marginTop: 5,
    fontSize: 6.9,
    color: MUTED,
    fontWeight: 600,
    letterSpacing: 0.65,
    lineHeight: 1,
  },

  /* 공통 타이포 */
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 9,
  },
  labelLine: {
    width: 20,
    height: 1.5,
    backgroundColor: GOLD,
    marginRight: 8,
  },
  label: {
    fontSize: 7.6,
    fontWeight: 800,
    letterSpacing: 1.3,
    color: GOLD,
    lineHeight: 1,
  },
  headline: {
    width: 350,
    fontSize: 30,
    fontWeight: 800,
    letterSpacing: -1,
    lineHeight: 1.18,
  },
  page2Headline: {
    fontSize: 23.5,
    fontWeight: 800,
    letterSpacing: -0.75,
    lineHeight: 1.22,
  },
  lead: {
    marginTop: 13,
    width: 338,
    fontSize: 10.7,
    fontWeight: 500,
    letterSpacing: -0.15,
    lineHeight: 1.62,
    color: NAVY_2,
  },
  page2Lead: {
    marginTop: 8,
    width: 480,
    fontSize: 9.6,
    fontWeight: 500,
    lineHeight: 1.55,
    color: NAVY_2,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: 800,
    letterSpacing: -0.35,
    lineHeight: 1.2,
  },
  sectionNote: {
    marginTop: 3,
    fontSize: 7.7,
    fontWeight: 500,
    color: MUTED,
    lineHeight: 1.35,
  },

  /* 1쪽 Hero */
  hero: {
    minHeight: 194,
    position: 'relative',
  },
  heroArtwork: {
    position: 'absolute',
    right: -3,
    top: 0,
    width: 162,
    height: 162,
    objectFit: 'contain',
  },
  heroTag: {
    position: 'absolute',
    left: 0,
    top: 158,
    flexDirection: 'row',
    alignItems: 'center',
    borderTopWidth: 0.8,
    borderBottomWidth: 0.8,
    borderColor: GOLD_LIGHT,
    paddingVertical: 6,
    paddingRight: 14,
  },
  heroTagMain: {
    fontSize: 7.8,
    fontWeight: 800,
    lineHeight: 1,
  },
  heroTagSub: {
    marginLeft: 8,
    fontSize: 6.8,
    fontWeight: 600,
    color: MUTED,
    lineHeight: 1,
  },

  /* 핵심 가치 3열 */
  overview: {
    borderTopWidth: 0.9,
    borderBottomWidth: 0.9,
    borderColor: GOLD_LIGHT,
    paddingVertical: 14,
    flexDirection: 'row',
  },
  overviewItem: {
    flex: 1,
    paddingRight: 15,
    borderRightWidth: 0.7,
    borderRightColor: GOLD_LIGHT,
  },
  overviewMid: {
    flex: 1,
    paddingHorizontal: 15,
    borderRightWidth: 0.7,
    borderRightColor: GOLD_LIGHT,
  },
  overviewLast: {
    flex: 1,
    paddingLeft: 15,
  },
  overviewN: {
    fontSize: 7.2,
    fontWeight: 800,
    color: GOLD,
    letterSpacing: 0.9,
    lineHeight: 1,
  },
  overviewTitle: {
    marginTop: 8,
    fontSize: 10.5,
    fontWeight: 800,
    lineHeight: 1.2,
  },
  overviewDesc: {
    marginTop: 6,
    fontSize: 7.8,
    fontWeight: 500,
    lineHeight: 1.45,
    color: NAVY_2,
  },

  /* 흐름 */
  journeyWrap: {
    marginTop: 19,
  },
  journey: {
    position: 'relative',
    marginTop: 12,
    flexDirection: 'row',
  },
  journeyLine: {
    position: 'absolute',
    top: 18,
    left: 62,
    right: 62,
    height: 1.2,
    backgroundColor: GOLD_LIGHT,
  },
  journeyItem: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: 8,
  },
  journeyCircle: {
    width: 37,
    height: 37,
    borderRadius: 19,
    backgroundColor: IVORY,
    borderWidth: 1.2,
    borderColor: GOLD,
    alignItems: 'center',
    justifyContent: 'center',
  },
  journeyN: {
    fontSize: 9.5,
    fontWeight: 800,
    color: GOLD,
    lineHeight: 1,
  },
  journeyTitle: {
    marginTop: 9,
    fontSize: 9.6,
    fontWeight: 800,
    textAlign: 'center',
    lineHeight: 1.2,
  },
  journeyDesc: {
    marginTop: 5,
    fontSize: 7.4,
    fontWeight: 500,
    textAlign: 'center',
    lineHeight: 1.42,
    color: NAVY_2,
  },

  /* 직무 */
  roles: {
    marginTop: 18,
  },
  roleGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 9,
  },
  role: {
    width: '31.9%',
    height: 27,
    marginRight: '2.15%',
    marginBottom: 7,
    borderRadius: 14,
    borderWidth: 0.8,
    borderColor: GOLD_LIGHT,
    backgroundColor: WHITE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  roleEnd: {
    width: '31.9%',
    height: 27,
    marginBottom: 7,
    borderRadius: 14,
    borderWidth: 0.8,
    borderColor: GOLD_LIGHT,
    backgroundColor: WHITE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  roleText: {
    fontSize: 8.4,
    fontWeight: 700,
    lineHeight: 1,
  },

  /* 2쪽 */
  page2Intro: {
    marginBottom: 15,
  },
  columns: {
    flexDirection: 'row',
  },
  timeline: {
    width: 306,
    paddingRight: 22,
    position: 'relative',
  },
  timelineLine: {
    position: 'absolute',
    top: 20,
    bottom: 12,
    left: 16,
    width: 1.2,
    backgroundColor: GOLD_LIGHT,
  },
  timelineStep: {
    minHeight: 95,
    flexDirection: 'row',
  },
  timelineCircle: {
    width: 33,
    height: 33,
    borderRadius: 17,
    backgroundColor: GOLD,
    alignItems: 'center',
    justifyContent: 'center',
  },
  timelineN: {
    color: WHITE,
    fontSize: 8.8,
    fontWeight: 800,
    lineHeight: 1,
  },
  timelineCopy: {
    flex: 1,
    marginLeft: 12,
    paddingTop: 1,
  },
  timelineTitle: {
    fontSize: 10.7,
    fontWeight: 800,
    lineHeight: 1.2,
  },
  timelineIntro: {
    marginTop: 4,
    fontSize: 7.7,
    fontWeight: 600,
    color: NAVY_2,
    lineHeight: 1.4,
  },
  bullet: {
    marginTop: 2,
    fontSize: 7.5,
    fontWeight: 500,
    color: NAVY_2,
    lineHeight: 1.42,
  },
  sidebar: {
    flex: 1,
  },
  sidePanel: {
    borderWidth: 0.9,
    borderColor: GOLD_LIGHT,
    backgroundColor: WHITE,
    padding: 12,
    marginBottom: 11,
  },
  sideEyebrow: {
    fontSize: 6.7,
    fontWeight: 800,
    letterSpacing: 1,
    color: GOLD,
    lineHeight: 1,
  },
  sideTitle: {
    marginTop: 7,
    fontSize: 10.3,
    fontWeight: 800,
    lineHeight: 1.2,
  },
  checklist: {
    marginTop: 8,
  },
  checkRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 5,
  },
  checkDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: GOLD,
    marginTop: 3.2,
    marginRight: 7,
  },
  checkText: {
    flex: 1,
    fontSize: 7.3,
    fontWeight: 500,
    lineHeight: 1.35,
    color: NAVY_2,
  },
  dashboard: {
    marginTop: 9,
    borderTopWidth: 0.8,
    borderBottomWidth: 0.8,
    borderColor: GOLD_LIGHT,
  },
  tabs: {
    flexDirection: 'row',
    paddingVertical: 7,
  },
  tabActive: {
    borderRadius: 8,
    backgroundColor: NAVY,
    color: WHITE,
    fontSize: 6.4,
    fontWeight: 800,
    paddingVertical: 3,
    paddingHorizontal: 6,
    marginRight: 4,
  },
  tab: {
    borderRadius: 8,
    borderWidth: 0.6,
    borderColor: GOLD_LIGHT,
    fontSize: 6.4,
    fontWeight: 700,
    paddingVertical: 2.5,
    paddingHorizontal: 5,
    marginRight: 4,
  },
  person: {
    minHeight: 27,
    flexDirection: 'row',
    alignItems: 'center',
    borderTopWidth: 0.5,
    borderTopColor: GOLD_LIGHT,
  },
  personName: {
    width: 48,
    fontSize: 7.2,
    fontWeight: 800,
  },
  personMeta: {
    flex: 1,
    fontSize: 6.4,
    color: MUTED,
    fontWeight: 500,
  },
  personStatus: {
    width: 33,
    fontSize: 6.4,
    fontWeight: 800,
    textAlign: 'right',
  },
  freePanel: {
    backgroundColor: NAVY,
    color: WHITE,
    padding: 12,
    minHeight: 70,
    justifyContent: 'center',
  },
  freeTitle: {
    fontSize: 10.3,
    fontWeight: 800,
    lineHeight: 1.2,
  },
  freeDesc: {
    marginTop: 6,
    fontSize: 7.3,
    fontWeight: 500,
    lineHeight: 1.45,
  },

  /* FAQ */
  faqWrap: {
    marginTop: 13,
    borderTopWidth: 0.9,
    borderTopColor: GOLD,
    paddingTop: 10,
  },
  faqRow: {
    flexDirection: 'row',
    marginTop: 8,
  },
  faq: {
    flex: 1,
    paddingRight: 12,
  },
  faqMid: {
    flex: 1,
    paddingHorizontal: 12,
    borderLeftWidth: 0.6,
    borderRightWidth: 0.6,
    borderColor: GOLD_LIGHT,
  },
  faqLast: {
    flex: 1,
    paddingLeft: 12,
  },
  faqQ: {
    fontSize: 7.8,
    fontWeight: 800,
    lineHeight: 1.3,
  },
  faqA: {
    marginTop: 4,
    fontSize: 6.9,
    fontWeight: 500,
    color: NAVY_2,
    lineHeight: 1.42,
  },

  /* CTA */
  cta: {
    marginHorizontal: 42,
    marginTop: 15,
    minHeight: 64,
    borderWidth: 1,
    borderColor: GOLD,
    backgroundColor: WHITE,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
  },
  ctaAccent: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 5,
    backgroundColor: GOLD,
  },
  ctaLabel: {
    fontSize: 7.5,
    fontWeight: 700,
    color: GOLD,
    letterSpacing: 0.3,
    lineHeight: 1,
  },
  ctaUrl: {
    marginTop: 5,
    fontSize: 20,
    fontWeight: 800,
    letterSpacing: -0.5,
    lineHeight: 1,
  },
  ctaRight: {
    alignItems: 'flex-end',
  },
  ctaStep: {
    fontSize: 7.6,
    fontWeight: 700,
    lineHeight: 1.5,
    textAlign: 'right',
  },
  ctaMail: {
    marginTop: 3,
    fontSize: 7.2,
    fontWeight: 500,
    color: MUTED,
    lineHeight: 1,
  },

  /* 하단 */
  footer: {
    marginHorizontal: 42,
    paddingTop: 9,
    paddingBottom: 13,
  },
  footerMain: {
    fontSize: 6.6,
    fontWeight: 700,
    lineHeight: 1.35,
  },
  footerSub: {
    marginTop: 2,
    fontSize: 6.3,
    fontWeight: 500,
    color: MUTED,
    lineHeight: 1.4,
  },
});

function LogoMark() {
  return h(
    Svg,
    { width: 28, height: 28, viewBox: '0 0 40 40' },
    [
      h(Rect, { key: 'r', width: 40, height: 40, rx: 9, fill: NAVY }),
      h(Path, {
        key: 'p1',
        d: 'M10 28V12.75L20 22.5l10-9.75V28',
        stroke: WHITE,
        strokeWidth: 3.4,
        strokeLinecap: 'round',
        strokeLinejoin: 'round',
      }),
      h(Path, {
        key: 'p2',
        d: 'M20 22.5V28',
        stroke: GOLD,
        strokeWidth: 3.4,
        strokeLinecap: 'round',
      }),
      h(Circle, { key: 'c', cx: 29, cy: 9.75, r: 2.1, fill: GOLD }),
    ],
  );
}

function Header({ page = 1 }) {
  return h(View, { style: s.header }, [
    h(View, { key: 'brand', style: s.brand }, [
      h(LogoMark, { key: 'mark' }),
      h(Text, { key: 'word', style: s.brandWord }, 'Marié'),
    ]),
    h(View, { key: 'meta', style: s.headerMeta }, [
      h(Text, { key: 'ad', style: s.adLabel }, page === 1 ? '(광고) · 웨딩홀 채용 안내' : '이용 안내 · 02'),
      h(Text, { key: 'sub', style: s.headerSub }, page === 1 ? 'FOR WEDDING BUSINESS' : 'HOW MARIÉ WORKS'),
    ]),
  ]);
}

function Label({ children }) {
  return h(View, { style: s.labelRow }, [
    h(View, { key: 'line', style: s.labelLine }),
    h(Text, { key: 'text', style: s.label }, children),
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
    h(View, { key: 'accent', style: s.ctaAccent }),
    h(View, { key: 'left' }, [
      h(Text, { key: 'label', style: s.ctaLabel }, detail ? '직접 둘러보고 시작하세요' : '업체 회원으로 시작하기'),
      h(Text, { key: 'url', style: s.ctaUrl }, 'marie.co.kr'),
    ]),
    h(View, { key: 'right', style: s.ctaRight }, [
      h(
        Text,
        { key: 'step', style: s.ctaStep },
        detail ? '채용 정보 · 인재/업체 프로필 · 커뮤니티' : '회원가입  →  업체 정보 입력  →  공고 등록',
      ),
      h(Text, { key: 'mail', style: s.ctaMail }, '문의  admin@marie.co.kr'),
    ]),
  ]);
}

function Overview({ n, title, desc, position }) {
  const style = position === 'last' ? s.overviewLast : position === 'mid' ? s.overviewMid : s.overviewItem;
  return h(View, { style }, [
    h(Text, { key: 'n', style: s.overviewN }, n),
    h(Text, { key: 'title', style: s.overviewTitle }, title),
    h(Text, { key: 'desc', style: s.overviewDesc }, desc),
  ]);
}

function Journey({ n, title, desc }) {
  return h(View, { style: s.journeyItem }, [
    h(View, { key: 'circle', style: s.journeyCircle }, h(Text, { style: s.journeyN }, n)),
    h(Text, { key: 'title', style: s.journeyTitle }, title),
    h(Text, { key: 'desc', style: s.journeyDesc }, desc),
  ]);
}

function Role({ children, end = false }) {
  return h(
    View,
    { style: end ? s.roleEnd : s.role },
    h(Text, { style: s.roleText }, children),
  );
}

function PageOne() {
  const roles = ['예약실 · 상담', '연회 · 식음', '예식 · 현장 진행', '웨딩플래너', '안내 · 예식 도우미', '주차 · 시설 관리'];

  return h(Page, { size: A4, style: s.page }, [
    h(Header, { key: 'header', page: 1 }),
    h(View, { key: 'body', style: s.body }, [
      h(View, { key: 'hero', style: s.hero }, [
        h(Image, { key: 'artwork', src: HERO_ARTWORK, style: s.heroArtwork }),
        h(Label, { key: 'label' }, 'WEDDING RECRUITING'),
        h(Text, { key: 'headline', style: s.headline }, '웨딩홀 채용을,\n한곳에서 더 편하게.'),
        h(
          Text,
          { key: 'lead', style: s.lead },
          '예약실 상담부터 연회·현장 진행·주차·시설까지. 필요한 자리를 공고로 알리고, 이력서를 받고, 적합한 지원자에게 직접 연락하세요.',
        ),
        h(View, { key: 'tag', style: s.heroTag }, [
          h(Text, { key: 'main', style: s.heroTagMain }, '채용 공고 등록 · 지원 현재 무료'),
          h(Text, { key: 'sub', style: s.heroTagSub }, '선택형 노출 상품 별도'),
        ]),
      ]),

      h(View, { key: 'overview', style: s.overview }, [
        h(Overview, {
          key: 'o1',
          n: '01 · PROFESSIONAL',
          title: '웨딩 업계에 맞는 채용',
          desc: '예식장·드레스·스튜디오·메이크업·플래너 등 업계 직무와 조건을 기준으로 공고를 등록합니다.',
          position: 'first',
        }),
        h(Overview, {
          key: 'o2',
          n: '02 · RESUME',
          title: '이력서로 받는 지원',
          desc: '개인 회원이 공고에 맞는 이력서와 연락처, 지원 한마디를 골라 제출합니다.',
          position: 'mid',
        }),
        h(Overview, {
          key: 'o3',
          n: '03 · MANAGE',
          title: '한눈에 보는 지원자',
          desc: '접수·검토 중·승인·거절로 분류하고 지원자별 비공개 메모를 남길 수 있습니다.',
          position: 'last',
        }),
      ]),

      h(View, { key: 'journeyWrap', style: s.journeyWrap }, [
        h(Text, { key: 'title', style: s.sectionTitle }, '마리에에서 채용이 이어지는 방법'),
        h(Text, { key: 'note', style: s.sectionNote }, '업체가 공고를 올리면 개인 회원이 이력서로 지원하고, 업체가 직접 검토·연락합니다.'),
        h(View, { key: 'journey', style: s.journey }, [
          h(View, { key: 'line', style: s.journeyLine }),
          h(Journey, { key: 'j1', n: '01', title: '공고 작성', desc: '직무·지역·근무 조건과\n담당 업무를 입력합니다.' }),
          h(Journey, { key: 'j2', n: '02', title: '이력서 접수', desc: '지원 시점의 이력서와\n연락처를 받습니다.' }),
          h(Journey, { key: 'j3', n: '03', title: '검토 · 연락', desc: '지원자를 분류하고\n필요한 분께 연락합니다.' }),
        ]),
      ]),

      h(View, { key: 'roles', style: s.roles }, [
        h(Text, { key: 'title', style: s.sectionTitle }, '이런 자리부터 올려보세요'),
        h(
          View,
          { key: 'grid', style: s.roleGrid },
          roles.map((role, index) => h(Role, { key: role, end: index % 3 === 2 }, role)),
        ),
      ]),
    ]),
    h(Cta, { key: 'cta' }),
    h(Footer, { key: 'footer' }),
  ]);
}

function TimelineStep({ n, title, intro, bullets }) {
  return h(View, { style: s.timelineStep }, [
    h(View, { key: 'circle', style: s.timelineCircle }, h(Text, { style: s.timelineN }, n)),
    h(View, { key: 'copy', style: s.timelineCopy }, [
      h(Text, { key: 'title', style: s.timelineTitle }, title),
      h(Text, { key: 'intro', style: s.timelineIntro }, intro),
      ...bullets.map((bullet) => h(Text, { key: bullet, style: s.bullet }, `•  ${bullet}`)),
    ]),
  ]);
}

function Check({ children }) {
  return h(View, { style: s.checkRow }, [
    h(View, { key: 'dot', style: s.checkDot }),
    h(Text, { key: 'text', style: s.checkText }, children),
  ]);
}

function Person({ name, meta, status }) {
  return h(View, { style: s.person }, [
    h(Text, { key: 'name', style: s.personName }, name),
    h(Text, { key: 'meta', style: s.personMeta }, meta),
    h(Text, { key: 'status', style: s.personStatus }, status),
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
    h(Header, { key: 'header', page: 2 }),
    h(View, { key: 'body', style: [s.body, { paddingTop: 18 }] }, [
      h(View, { key: 'intro', style: s.page2Intro }, [
        h(Label, { key: 'label' }, 'STEP BY STEP'),
        h(Text, { key: 'headline', style: s.page2Headline }, '가입부터 지원자 연락까지,\n실제 이용 흐름을 담았습니다.'),
        h(
          Text,
          { key: 'lead', style: s.page2Lead },
          '업체 회원이 준비할 정보와 지원자가 도착한 뒤 확인할 화면을 순서대로 정리했습니다.',
        ),
      ]),

      h(View, { key: 'columns', style: s.columns }, [
        h(View, { key: 'timeline', style: s.timeline }, [
          h(View, { key: 'line', style: s.timelineLine }),
          h(TimelineStep, {
            key: 't1',
            n: '01',
            title: '업체 프로필 준비',
            intro: '공고 등록 전에 핵심 업체 정보를 채웁니다.',
            bullets: ['업체명 · 업종', '활동 지역 · 연락처', '소개 · 사진 · 갤러리는 선택'],
          }),
          h(TimelineStep, {
            key: 't2',
            n: '02',
            title: '채용 공고 작성',
            intro: '구직자가 궁금해할 조건을 항목별로 적습니다.',
            bullets: ['제목 · 업종 · 고용형태 · 지역', '급여 · 경력 · 마감일', '담당 업무 · 지원 자격 · 근무 조건'],
          }),
          h(TimelineStep, {
            key: 't3',
            n: '03',
            title: '이력서로 지원 접수',
            intro: '개인 회원이 공고에 맞는 이력서를 골라 지원합니다.',
            bullets: ['이력서 · 연락처 · 지원 한마디', '지원 시점의 내용이 제출본으로 보관', '이력서는 최대 5개까지 관리'],
          }),
          h(TimelineStep, {
            key: 't4',
            n: '04',
            title: '지원자 검토 및 연락',
            intro: '공고별 지원자를 상태에 따라 정리합니다.',
            bullets: ['접수 · 검토 중 · 승인 · 거절', '제출 이력서와 연락처 확인', '지원자별 비공개 메모'],
          }),
        ]),

        h(View, { key: 'sidebar', style: s.sidebar }, [
          h(View, { key: 'prep', style: s.sidePanel }, [
            h(Text, { key: 'eye', style: s.sideEyebrow }, 'POSTING CHECKLIST'),
            h(Text, { key: 'title', style: s.sideTitle }, '공고에 담을 내용'),
            h(View, { key: 'list', style: s.checklist }, [
              h(Check, { key: 'c1' }, '근무할 직무와 고용형태'),
              h(Check, { key: 'c2' }, '지역·급여·필요 경력'),
              h(Check, { key: 'c3' }, '담당 업무와 지원 자격'),
              h(Check, { key: 'c4' }, '근무 조건과 마감일'),
              h(Check, { key: 'c5' }, '대표 사진·추가 사진은 선택'),
            ]),
          ]),

          h(View, { key: 'manage', style: s.sidePanel }, [
            h(Text, { key: 'eye', style: s.sideEyebrow }, 'APPLICANT VIEW'),
            h(Text, { key: 'title', style: s.sideTitle }, '지원자는 이렇게 정리됩니다'),
            h(View, { key: 'dash', style: s.dashboard }, [
              h(View, { key: 'tabs', style: s.tabs }, [
                h(Text, { key: 'all', style: s.tabActive }, '전체'),
                h(Text, { key: 'new', style: s.tab }, '접수'),
                h(Text, { key: 'review', style: s.tab }, '검토 중'),
                h(Text, { key: 'ok', style: s.tab }, '승인'),
              ]),
              h(Person, { key: 'p1', name: '지원자 A', meta: '이력서 · 연락처', status: '접수' }),
              h(Person, { key: 'p2', name: '지원자 B', meta: '이력서 · 메모', status: '검토 중' }),
              h(Person, { key: 'p3', name: '지원자 C', meta: '이력서 · 상태', status: '승인' }),
            ]),
          ]),

          h(View, { key: 'free', style: s.freePanel }, [
            h(Text, { key: 'title', style: s.freeTitle }, '채용 공고 등록과 지원,\n현재 무료입니다.'),
            h(Text, { key: 'desc', style: s.freeDesc }, '목록 상단 노출·광고 등 선택형 유료 상품은 별도로 이용할 수 있습니다.'),
          ]),
        ]),
      ]),

      h(View, { key: 'faq', style: s.faqWrap }, [
        h(Text, { key: 'title', style: s.sectionTitle }, '자주 묻는 질문'),
        h(View, { key: 'row', style: s.faqRow }, [
          h(Faq, {
            key: 'f1',
            q: '누가 공고를 올리나요?',
            a: '업체 회원이 공고를 등록하고, 개인 회원이 이력서로 지원합니다.',
            position: 'first',
          }),
          h(Faq, {
            key: 'f2',
            q: '어떤 직무를 올릴 수 있나요?',
            a: '예약실·연회·현장 진행·플래너·도우미·주차·시설 등 웨딩 관련 직무를 다룹니다.',
            position: 'mid',
          }),
          h(Faq, {
            key: 'f3',
            q: '지원자는 어떻게 확인하나요?',
            a: '공고별 지원 화면에서 제출 이력서·연락처·상태와 비공개 메모를 확인합니다.',
            position: 'last',
          }),
        ]),
      ]),
    ]),
    h(Cta, { key: 'cta', detail: true }),
    h(Footer, { key: 'footer', compact: true }),
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
