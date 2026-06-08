import { NextResponse } from 'next/server';
import { renderToBuffer } from '@react-pdf/renderer';
import { createServerQueryClient } from '@/lib/supabase/server-query';
import { SettlementDocument } from '@/features/pdf/documents/SettlementDocument';
import type { Settlement } from '@/types/database';

export const dynamic = 'force-dynamic';

const SETTLEMENT_QUERY = `
  *,
  contract:contracts(id, title, event_date, party_a_org_name, party_b_org_name, party_a_profile_id, party_b_profile_id),
  payee:profiles!payee_profile_id(id, company_name, contact_name)
`;

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const supabase = createServerQueryClient();
  const { data, error } = await supabase
    .from('settlements')
    .select(SETTLEMENT_QUERY)
    .eq('id', params.id)
    .is('deleted_at', null)
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: 'not_found' }, { status: 404 });

  const settlement = data as unknown as Settlement;

  try {
    const buffer = await renderToBuffer(<SettlementDocument settlement={settlement} />);
    const docNumber = `S-${settlement.id.slice(0, 8).toUpperCase()}`;
    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="${docNumber}.pdf"`,
        'Cache-Control': 'private, no-cache',
      },
    });
  } catch (err) {
    console.error('[pdf/settlement]', err);
    return NextResponse.json({ error: 'pdf_generation_failed' }, { status: 500 });
  }
}
