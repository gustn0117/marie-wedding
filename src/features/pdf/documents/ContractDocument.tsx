import { Document, Page, Text, View } from '@react-pdf/renderer';
import type { Contract } from '@/types/database';
import { COLORS, ensureFontsRegistered, formatDate, formatDateTime, formatKRW, styles } from '../lib/pdfStyles';

ensureFontsRegistered();

export function ContractDocument({ contract }: { contract: Contract }) {
  const items = contract.quotation?.items ?? [];
  const docNumber = `C-${contract.id.slice(0, 8).toUpperCase()}`;
  const partyASignature = contract.signatures?.find((s) => s.signer_side === 'party_a');
  const partyBSignature = contract.signatures?.find((s) => s.signer_side === 'party_b');

  return (
    <Document title={`계약서 - ${contract.title}`} author="Marié">
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <Text style={styles.documentTitle}>계약서</Text>
          <View style={styles.brandWrapper}>
            <Text style={styles.brand}>Marié</Text>
            <Text style={styles.brandSub}>웨딩 업계 B2B 네트워크</Text>
          </View>
        </View>

        <View style={styles.docMeta}>
          <Text>문서번호 {docNumber}</Text>
          <Text>·</Text>
          <Text>발행일 {formatDate(contract.created_at)}</Text>
          {contract.signed_at && (
            <>
              <Text>·</Text>
              <Text>체결일 {formatDate(contract.signed_at)}</Text>
            </>
          )}
        </View>

        {/* 양 당사자 */}
        <View style={styles.partiesRow}>
          <View style={styles.partyBox}>
            <Text style={styles.partyLabel}>갑 (Party A)</Text>
            <Text style={styles.partyName}>{contract.party_a_org_name}</Text>
          </View>
          <View style={styles.partyBox}>
            <Text style={styles.partyLabel}>을 (Party B)</Text>
            <Text style={styles.partyName}>{contract.party_b_org_name}</Text>
          </View>
        </View>

        {/* 도입부 */}
        <Text style={styles.paragraph}>
          상기 갑과 을은 웨딩 사업과 관련하여 아래와 같이 합의하고 본 계약을 체결한다.
        </Text>

        {/* 계약 내용 */}
        <Text style={styles.sectionHeading}>제1조 (계약의 목적과 내용)</Text>
        <Text style={[styles.paragraph, { fontWeight: 700, fontSize: 11 }]}>{contract.title}</Text>
        {contract.description && <Text style={styles.paragraph}>{contract.description}</Text>}

        {/* 예식 */}
        <Text style={styles.sectionHeading}>제2조 (예식 정보)</Text>
        <View style={{ flexDirection: 'row', gap: 24, marginBottom: 12 }}>
          <View>
            <Text style={styles.muted}>예식 일자</Text>
            <Text style={{ fontSize: 10, fontWeight: 600, marginTop: 2 }}>{formatDate(contract.event_date)}</Text>
          </View>
          {contract.event_venue && (
            <View>
              <Text style={styles.muted}>예식 장소</Text>
              <Text style={{ fontSize: 10, fontWeight: 600, marginTop: 2 }}>{contract.event_venue}</Text>
            </View>
          )}
        </View>

        {/* 라인 항목 */}
        <Text style={styles.sectionHeading}>제3조 (계약 항목)</Text>
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
                <Text style={[styles.tableCell, { flex: 1 }]}>{item.description}</Text>
                <Text style={[styles.tableCell, { width: 60, textAlign: 'right' }]}>{formatKRW(item.quantity)}</Text>
                <Text style={[styles.tableCell, { width: 90, textAlign: 'right' }]}>{formatKRW(item.unit_price)}</Text>
                <Text style={[styles.tableCell, { width: 100, textAlign: 'right', fontWeight: 600 }]}>{formatKRW(item.line_total)}</Text>
              </View>
            ))
          )}
        </View>

        {/* 총액 */}
        <Text style={styles.sectionHeading}>제4조 (계약 금액)</Text>
        <View style={styles.totalsTable}>
          <View style={styles.grandTotalRow}>
            <Text style={styles.grandTotalLabel}>계약 총액</Text>
            <Text style={styles.grandTotalValue}>{formatKRW(contract.total_amount)} 원</Text>
          </View>
        </View>

        {/* 결제·취소 조항 */}
        {contract.payment_terms && (
          <>
            <Text style={styles.sectionHeading}>제5조 (결제 조건)</Text>
            <Text style={styles.paragraph}>{contract.payment_terms}</Text>
          </>
        )}
        {contract.cancellation_terms && (
          <>
            <Text style={styles.sectionHeading}>제6조 (계약의 취소)</Text>
            <Text style={styles.paragraph}>{contract.cancellation_terms}</Text>
          </>
        )}

        {/* 서명 박스 */}
        <View style={styles.signatureRow} break={items.length > 8}>
          <View style={styles.signatureBox}>
            <Text style={styles.signatureLabel}>갑 (Party A) 서명</Text>
            <Text style={styles.signatureName}>{contract.party_a_org_name}</Text>
            {partyASignature ? (
              <Text style={styles.signedStamp}>
                ✓ 전자 서명 완료 {'\n'}
                {formatDateTime(partyASignature.signed_at)}
              </Text>
            ) : (
              <Text style={styles.signaturePending}>서명 대기 중</Text>
            )}
          </View>
          <View style={styles.signatureBox}>
            <Text style={styles.signatureLabel}>을 (Party B) 서명</Text>
            <Text style={styles.signatureName}>{contract.party_b_org_name}</Text>
            {partyBSignature ? (
              <Text style={styles.signedStamp}>
                ✓ 전자 서명 완료 {'\n'}
                {formatDateTime(partyBSignature.signed_at)}
              </Text>
            ) : (
              <Text style={styles.signaturePending}>서명 대기 중</Text>
            )}
          </View>
        </View>

        <View style={styles.footer} fixed>
          <Text>Marié — 본 문서는 marie-wedding.hsweb.pics에서 전자 서명되었습니다</Text>
          <Text render={({ pageNumber, totalPages }) => `${pageNumber}/${totalPages}`} />
        </View>
      </Page>
    </Document>
  );
}
