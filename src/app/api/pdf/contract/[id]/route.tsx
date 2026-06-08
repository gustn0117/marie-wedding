import { NextResponse } from 'next/server';
import { renderToBuffer } from '@react-pdf/renderer';
import { createServerQueryClient } from '@/lib/supabase/server-query';
import { ContractDocument } from '@/features/pdf/documents/ContractDocument';
import type { Contract } from '@/types/database';

export const dynamic = 'force-dynamic';

const CONTRACT_QUERY = `
  *,
  signatures:contract_signatures(*),
  party_a:profiles!party_a_profile_id(id, company_name, contact_name),
  party_b:profiles!party_b_profile_id(id, company_name, contact_name),
  quotation:quotations(*, items:quotation_items(*))
`;

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const supabase = createServerQueryClient();
  const { data, error } = await supabase
    .from('contracts')
    .select(CONTRACT_QUERY)
    .eq('id', params.id)
    .is('deleted_at', null)
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: 'not_found' }, { status: 404 });

  const contract = data as unknown as Contract;

  try {
    const buffer = await renderToBuffer(<ContractDocument contract={contract} />);
    const docNumber = `C-${contract.id.slice(0, 8).toUpperCase()}`;
    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="${docNumber}.pdf"`,
        'Cache-Control': 'private, no-cache',
      },
    });
  } catch (err) {
    console.error('[pdf/contract]', err);
    return NextResponse.json({ error: 'pdf_generation_failed' }, { status: 500 });
  }
}
