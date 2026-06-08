import { Document, Page, Text, View } from '@react-pdf/renderer';
import type { Settlement } from '@/types/database';
import { COLORS, ensureFontsRegistered, formatDate, formatDateTime, formatKRW, styles } from '../lib/pdfStyles';

ensureFontsRegistered();

export function SettlementDocument({ settlement }: { settlement: Settlement }) {
  const docNumber = `S-${settlement.id.slice(0, 8).toUpperCase()}`;
  const feePercent = (settlement.platform_fee_rate * 100).toFixed(1);
  const payeeName = settlement.payee?.company_name || settlement.payee?.contact_name || '수령자';
  const counterpartyName =
    settlement.contract?.party_a_profile_id === settlement.payee_profile_id
      ? settlement.contract?.party_b_org_name
      : settlement.contract?.party_a_org_name;

  return (
    <Document title={`정산내역서 - ${settlement.contract?.title ?? settlement.id}`} author="Marié">
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <Text style={styles.documentTitle}>정산내역서</Text>
          <View style={styles.brandWrapper}>
            <Text style={styles.brand}>Marié</Text>
            <Text style={styles.brandSub}>웨딩 업계 B2B 네트워크</Text>
          </View>
        </View>

        <View style={styles.docMeta}>
          <Text>문서번호 {docNumber}</Text>
          <Text>·</Text>
          <Text>발행일 {formatDate(settlement.created_at)}</Text>
          {settlement.paid_at && (
            <>
              <Text>·</Text>
              <Text>송금일 {formatDate(settlement.paid_at)}</Text>
            </>
          )}
        </View>

        {/* 수령자·발주 */}
        <View style={styles.partiesRow}>
          <View style={styles.partyBox}>
            <Text style={styles.partyLabel}>수령자 (공급자)</Text>
            <Text style={styles.partyName}>{payeeName}</Text>
          </View>
          <View style={styles.partyBox}>
            <Text style={styles.partyLabel}>거래처</Text>
            <Text style={styles.partyName}>{counterpartyName ?? '-'}</Text>
          </View>
        </View>

        {/* 계약 */}
        <Text style={styles.sectionHeading}>관련 계약</Text>
        <View style={{ paddingVertical: 10, paddingHorizontal: 12, backgroundColor: COLORS.gray50, borderRadius: 4, borderWidth: 1, borderColor: COLORS.gray200, marginBottom: 16 }}>
          <Text style={{ fontSize: 11, fontWeight: 700 }}>{settlement.contract?.title ?? '-'}</Text>
          {settlement.contract?.event_date && (
            <Text style={[styles.muted, { marginTop: 4 }]}>예식 일자 {formatDate(settlement.contract.event_date)}</Text>
          )}
        </View>

        {/* 금액 분해 */}
        <Text style={styles.sectionHeading}>정산 금액 분해</Text>
        <View style={{ borderWidth: 1, borderColor: COLORS.gray300, borderRadius: 4, marginBottom: 18 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', padding: 12, borderBottomWidth: 1, borderBottomColor: COLORS.gray100 }}>
            <Text style={{ fontSize: 10, color: COLORS.gray700 }}>계약 총액 (Gross)</Text>
            <Text style={{ fontSize: 11, fontWeight: 700 }}>{formatKRW(settlement.gross_amount)} 원</Text>
          </View>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', padding: 12, borderBottomWidth: 1, borderBottomColor: COLORS.gray100 }}>
            <Text style={{ fontSize: 10, color: COLORS.gray700 }}>플랫폼 수수료 ({feePercent}%)</Text>
            <Text style={{ fontSize: 11, fontWeight: 600, color: COLORS.rose }}>- {formatKRW(settlement.platform_fee_amount)} 원</Text>
          </View>
          {settlement.tax_withheld > 0 && (
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', padding: 12, borderBottomWidth: 1, borderBottomColor: COLORS.gray100 }}>
              <Text style={{ fontSize: 10, color: COLORS.gray700 }}>원천세</Text>
              <Text style={{ fontSize: 11, fontWeight: 600, color: COLORS.rose }}>- {formatKRW(settlement.tax_withheld)} 원</Text>
            </View>
          )}
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', padding: 14, backgroundColor: COLORS.gray50 }}>
            <Text style={{ fontSize: 12, fontWeight: 800 }}>실수령 (Net)</Text>
            <Text style={{ fontSize: 16, fontWeight: 800, color: COLORS.primary }}>{formatKRW(settlement.net_amount)} 원</Text>
          </View>
        </View>

        {/* 송금 정보 */}
        {(settlement.payout_method || settlement.payout_account || settlement.payout_reference) && (
          <>
            <Text style={styles.sectionHeading}>송금 정보</Text>
            <View style={{ marginBottom: 12 }}>
              {settlement.payout_method && (
                <Text style={styles.paragraph}>
                  <Text style={styles.muted}>송금 방법: </Text>
                  {settlement.payout_method === 'bank_transfer' ? '계좌 이체' : settlement.payout_method}
                </Text>
              )}
              {settlement.payout_account && (
                <Text style={styles.paragraph}>
                  <Text style={styles.muted}>송금 계좌: </Text>
                  {settlement.payout_account}
                </Text>
              )}
              {settlement.payout_reference && (
                <Text style={styles.paragraph}>
                  <Text style={styles.muted}>참조번호: </Text>
                  {settlement.payout_reference}
                </Text>
              )}
            </View>
          </>
        )}

        {/* 처리 이력 */}
        <Text style={styles.sectionHeading}>처리 이력</Text>
        <View>
          <Text style={styles.paragraph}>
            <Text style={styles.muted}>생성: </Text>
            {formatDateTime(settlement.created_at)}
          </Text>
          {settlement.scheduled_at && (
            <Text style={styles.paragraph}>
              <Text style={styles.muted}>승인 + 송금 예정: </Text>
              {formatDateTime(settlement.scheduled_at)}
            </Text>
          )}
          {settlement.paid_at && (
            <Text style={[styles.paragraph, { color: COLORS.emerald, fontWeight: 700 }]}>
              [완료] 송금 완료: {formatDateTime(settlement.paid_at)}
            </Text>
          )}
          {settlement.failed_at && (
            <Text style={[styles.paragraph, { color: COLORS.rose, fontWeight: 700 }]}>
              [실패] 송금 실패: {formatDateTime(settlement.failed_at)}
              {settlement.failure_reason && ` — ${settlement.failure_reason}`}
            </Text>
          )}
        </View>

        <View style={styles.footer} fixed>
          <Text>Marié — 본 정산서는 거래 증빙 자료로 활용 가능합니다 (marie-wedding.hsweb.pics)</Text>
          <Text render={({ pageNumber, totalPages }) => `${pageNumber}/${totalPages}`} />
        </View>
      </Page>
    </Document>
  );
}
