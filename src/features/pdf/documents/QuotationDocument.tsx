/* eslint-disable react/no-unescaped-entities */
import { Document, Page, Text, View } from '@react-pdf/renderer';
import type { Quotation } from '@/types/database';
import { COLORS, ensureFontsRegistered, formatDate, formatKRW, styles } from '../lib/pdfStyles';

ensureFontsRegistered();

export function QuotationDocument({ quotation }: { quotation: Quotation }) {
  const items = quotation.items ?? [];
  const senderName = quotation.sender?.company_name || quotation.sender?.contact_name || '발신';
  const receiverName = quotation.receiver?.company_name || quotation.receiver?.contact_name || '수신';
  const docNumber = `Q-${quotation.id.slice(0, 8).toUpperCase()}`;

  return (
    <Document title={`견적서 - ${quotation.title}`} author="Marié">
      <Page size="A4" style={styles.page}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.documentTitle}>견적서</Text>
          <View style={styles.brandWrapper}>
            <Text style={styles.brand}>Marié</Text>
            <Text style={styles.brandSub}>웨딩 업계 B2B 네트워크</Text>
          </View>
        </View>

        {/* 메타 */}
        <View style={styles.docMeta}>
          <Text>문서번호 {docNumber}</Text>
          <Text>·</Text>
          <Text>발행일 {formatDate(quotation.created_at)}</Text>
          {quotation.valid_until && (
            <>
              <Text>·</Text>
              <Text>유효기한 {formatDate(quotation.valid_until)}</Text>
            </>
          )}
        </View>

        {/* 양 당사자 */}
        <View style={styles.partiesRow}>
          <View style={styles.partyBox}>
            <Text style={styles.partyLabel}>공급자 (발신)</Text>
            <Text style={styles.partyName}>{senderName}</Text>
            {quotation.sender?.contact_name && quotation.sender?.company_name && (
              <Text style={styles.partyDetail}>담당자 {quotation.sender.contact_name}</Text>
            )}
          </View>
          <View style={styles.partyBox}>
            <Text style={styles.partyLabel}>수신자</Text>
            <Text style={styles.partyName}>{receiverName}</Text>
            {quotation.receiver?.contact_name && quotation.receiver?.company_name && (
              <Text style={styles.partyDetail}>담당자 {quotation.receiver.contact_name}</Text>
            )}
          </View>
        </View>

        {/* 제목 + 설명 */}
        <Text style={styles.sectionHeading}>견적 내용</Text>
        <Text style={[styles.paragraph, { fontWeight: 700, fontSize: 12 }]}>{quotation.title}</Text>
        {quotation.description && <Text style={styles.paragraph}>{quotation.description}</Text>}

        {/* 예식 정보 */}
        {(quotation.event_date || quotation.event_venue) && (
          <View style={{ flexDirection: 'row', gap: 16, marginBottom: 16 }}>
            {quotation.event_date && (
              <View>
                <Text style={styles.muted}>예식 일자</Text>
                <Text style={{ fontSize: 10, fontWeight: 600, marginTop: 2 }}>{formatDate(quotation.event_date)}</Text>
              </View>
            )}
            {quotation.event_venue && (
              <View>
                <Text style={styles.muted}>예식 장소</Text>
                <Text style={{ fontSize: 10, fontWeight: 600, marginTop: 2 }}>{quotation.event_venue}</Text>
              </View>
            )}
          </View>
        )}

        {/* 항목 표 */}
        <Text style={styles.sectionHeading}>견적 항목</Text>
        <View style={styles.table}>
          <View style={styles.tableHead}>
            <Text style={[styles.tableHeadCell, { width: 24 }]}>#</Text>
            <Text style={[styles.tableHeadCell, { flex: 1 }]}>항목</Text>
            <Text style={[styles.tableHeadCell, { width: 60, textAlign: 'right' }]}>수량</Text>
            <Text style={[styles.tableHeadCell, { width: 90, textAlign: 'right' }]}>단가</Text>
            <Text style={[styles.tableHeadCell, { width: 100, textAlign: 'right' }]}>금액</Text>
          </View>
          {items.length === 0 ? (
            <View style={styles.tableRow}>
              <Text style={[styles.tableCell, { textAlign: 'center', flex: 1, color: COLORS.gray400 }]}>
                항목 없음
              </Text>
            </View>
          ) : (
            items.map((item, idx) => (
              <View key={item.id} style={[styles.tableRow, idx % 2 === 1 ? styles.tableRowAlt : {}]} wrap={false}>
                <Text style={[styles.tableCell, { width: 24, color: COLORS.gray500 }]}>{idx + 1}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={styles.tableCell}>{item.description}</Text>
                  {item.note && <Text style={[styles.tableCell, { fontSize: 8, color: COLORS.gray500, marginTop: 1 }]}>{item.note}</Text>}
                </View>
                <Text style={[styles.tableCell, { width: 60, textAlign: 'right' }]}>{formatKRW(item.quantity)}</Text>
                <Text style={[styles.tableCell, { width: 90, textAlign: 'right' }]}>{formatKRW(item.unit_price)}</Text>
                <Text style={[styles.tableCell, { width: 100, textAlign: 'right', fontWeight: 600 }]}>{formatKRW(item.line_total)}</Text>
              </View>
            ))
          )}
        </View>

        {/* 합계 */}
        <View style={styles.totalsTable}>
          <View style={styles.totalsRow}>
            <Text style={styles.totalsLabel}>소계</Text>
            <Text style={styles.totalsValue}>{formatKRW(quotation.subtotal)} 원</Text>
          </View>
          <View style={styles.totalsRow}>
            <Text style={styles.totalsLabel}>부가세 (VAT 10%)</Text>
            <Text style={styles.totalsValue}>{formatKRW(quotation.tax)} 원</Text>
          </View>
          <View style={styles.grandTotalRow}>
            <Text style={styles.grandTotalLabel}>총액</Text>
            <Text style={styles.grandTotalValue}>{formatKRW(quotation.total_amount)} 원</Text>
          </View>
        </View>

        {/* 비고 */}
        {quotation.status === 'rejected' && quotation.rejection_reason && (
          <View style={{ padding: 10, backgroundColor: '#fff1f2', borderRadius: 4, marginBottom: 12 }}>
            <Text style={{ fontSize: 9, fontWeight: 700, color: COLORS.rose, marginBottom: 2 }}>거절 사유</Text>
            <Text style={{ fontSize: 9, color: COLORS.ink }}>{quotation.rejection_reason}</Text>
          </View>
        )}

        {/* Footer */}
        <View style={styles.footer} fixed>
          <Text>Marié — 웨딩 업계 B2B 네트워크 · marie-wedding.hsweb.pics</Text>
          <Text render={({ pageNumber, totalPages }) => `${pageNumber}/${totalPages}`} />
        </View>
      </Page>
    </Document>
  );
}
