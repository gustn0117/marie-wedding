/**
 * 공용 PDF 디자인 토큰 + 한글 폰트 등록.
 *
 * 폰트: Pretendard (한글 굵기 다양 + 자유 라이선스)
 * 자체호스팅 jsdelivr CDN의 .otf로 등록 (gh CDN은 안정적).
 */
import { Font, StyleSheet } from '@react-pdf/renderer';

const FONT_BASE = 'https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/packages/pretendard/dist/public/static';

let registered = false;

export function ensureFontsRegistered() {
  if (registered) return;
  Font.register({
    family: 'Pretendard',
    fonts: [
      { src: `${FONT_BASE}/Pretendard-Regular.otf`, fontWeight: 400 },
      { src: `${FONT_BASE}/Pretendard-Medium.otf`, fontWeight: 500 },
      { src: `${FONT_BASE}/Pretendard-SemiBold.otf`, fontWeight: 600 },
      { src: `${FONT_BASE}/Pretendard-Bold.otf`, fontWeight: 700 },
      { src: `${FONT_BASE}/Pretendard-ExtraBold.otf`, fontWeight: 800 },
    ],
  });
  registered = true;
}

// 색상 토큰
export const COLORS = {
  ink: '#1a1a1a',
  primary: '#051049',
  gray50: '#fafafa',
  gray100: '#f4f4f5',
  gray200: '#e4e4e7',
  gray300: '#d4d4d8',
  gray400: '#a1a1aa',
  gray500: '#71717a',
  gray600: '#52525b',
  gray700: '#3f3f46',
  rose: '#e11d48',
  emerald: '#059669',
  amber: '#d97706',
} as const;

// 공통 스타일
export const styles = StyleSheet.create({
  page: {
    flexDirection: 'column',
    backgroundColor: '#ffffff',
    fontFamily: 'Pretendard',
    fontSize: 10,
    paddingTop: 48,
    paddingBottom: 56,
    paddingHorizontal: 48,
    color: COLORS.ink,
  },
  // 페이지 헤더 (상단)
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingBottom: 16,
    borderBottomWidth: 2,
    borderBottomColor: COLORS.ink,
    marginBottom: 24,
  },
  documentTitle: {
    fontSize: 24,
    fontWeight: 800,
    letterSpacing: -0.5,
  },
  brandWrapper: {
    flexDirection: 'column',
    alignItems: 'flex-end',
  },
  brand: {
    fontSize: 14,
    fontWeight: 800,
    color: COLORS.primary,
    letterSpacing: -0.3,
  },
  brandSub: {
    fontSize: 8,
    color: COLORS.gray500,
    marginTop: 2,
  },
  docMeta: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 18,
    color: COLORS.gray600,
    fontSize: 9,
  },
  // 당사자 박스 (양 당사자 정보)
  partiesRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 24,
  },
  partyBox: {
    flex: 1,
    padding: 12,
    backgroundColor: COLORS.gray50,
    borderWidth: 1,
    borderColor: COLORS.gray200,
    borderRadius: 4,
  },
  partyLabel: {
    fontSize: 8,
    fontWeight: 700,
    color: COLORS.gray500,
    marginBottom: 6,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  partyName: {
    fontSize: 12,
    fontWeight: 700,
    color: COLORS.ink,
  },
  partyDetail: {
    fontSize: 9,
    color: COLORS.gray600,
    marginTop: 3,
  },
  // 섹션 헤딩
  sectionHeading: {
    fontSize: 11,
    fontWeight: 700,
    color: COLORS.ink,
    marginBottom: 8,
    marginTop: 4,
  },
  // 테이블
  table: {
    borderWidth: 1,
    borderColor: COLORS.gray300,
    borderRadius: 4,
    marginBottom: 16,
    overflow: 'hidden',
  },
  tableHead: {
    flexDirection: 'row',
    backgroundColor: COLORS.gray100,
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.gray300,
  },
  tableHeadCell: {
    fontSize: 8,
    fontWeight: 700,
    color: COLORS.gray600,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  tableRow: {
    flexDirection: 'row',
    paddingVertical: 7,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.gray100,
  },
  tableCell: {
    fontSize: 9.5,
    color: COLORS.ink,
  },
  tableRowAlt: {
    backgroundColor: COLORS.gray50,
  },
  // 금액 합계
  totalsTable: {
    marginLeft: 'auto',
    width: 240,
    padding: 12,
    backgroundColor: COLORS.gray50,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: COLORS.gray200,
    marginBottom: 16,
  },
  totalsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 3,
    fontSize: 9.5,
  },
  totalsLabel: { color: COLORS.gray600 },
  totalsValue: { color: COLORS.ink },
  grandTotalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: 8,
    marginTop: 4,
    borderTopWidth: 1,
    borderTopColor: COLORS.gray300,
  },
  grandTotalLabel: {
    fontSize: 10,
    fontWeight: 800,
    color: COLORS.ink,
  },
  grandTotalValue: {
    fontSize: 14,
    fontWeight: 800,
    color: COLORS.primary,
  },
  // 서명 박스
  signatureRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 28,
  },
  signatureBox: {
    flex: 1,
    minHeight: 90,
    padding: 12,
    borderWidth: 1,
    borderColor: COLORS.gray300,
    borderRadius: 4,
  },
  signatureLabel: {
    fontSize: 8,
    fontWeight: 700,
    color: COLORS.gray500,
    marginBottom: 4,
    textTransform: 'uppercase',
  },
  signatureName: {
    fontSize: 11,
    fontWeight: 700,
    color: COLORS.ink,
  },
  signedStamp: {
    marginTop: 16,
    paddingVertical: 6,
    paddingHorizontal: 10,
    backgroundColor: COLORS.gray50,
    borderRadius: 2,
    fontSize: 9,
    color: COLORS.emerald,
    fontWeight: 700,
    alignSelf: 'flex-start',
  },
  signaturePending: {
    marginTop: 16,
    paddingVertical: 6,
    paddingHorizontal: 10,
    backgroundColor: COLORS.gray50,
    borderRadius: 2,
    fontSize: 9,
    color: COLORS.gray500,
    fontWeight: 600,
    alignSelf: 'flex-start',
  },
  // 푸터
  footer: {
    position: 'absolute',
    bottom: 24,
    left: 48,
    right: 48,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: COLORS.gray200,
    fontSize: 8,
    color: COLORS.gray500,
  },
  // 공통 텍스트
  paragraph: {
    fontSize: 10,
    lineHeight: 1.55,
    color: COLORS.ink,
    marginBottom: 8,
  },
  muted: {
    fontSize: 8,
    color: COLORS.gray500,
  },
});

export function formatKRW(n: number): string {
  return new Intl.NumberFormat('ko-KR').format(n);
}

export function formatDate(iso: string | null | undefined): string {
  if (!iso) return '-';
  try {
    const d = new Date(iso);
    return `${d.getFullYear()}년 ${d.getMonth() + 1}월 ${d.getDate()}일`;
  } catch {
    return iso;
  }
}

export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return '-';
  try {
    const d = new Date(iso);
    return `${formatDate(iso)} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  } catch {
    return iso;
  }
}
