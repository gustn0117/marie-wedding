import { NextResponse } from 'next/server';
import { renderToBuffer } from '@react-pdf/renderer';
import { createServerQueryClient } from '@/lib/supabase/server-query';
import { QuotationDocument } from '@/features/pdf/documents/QuotationDocument';
import type { Quotation } from '@/types/database';

export const dynamic = 'force-dynamic';

const QUOTATION_QUERY = `
  *,
  items:quotation_items(*),
  sender:profiles!sender_profile_id(id, company_name, contact_name, profile_image, verification_status),
  receiver:profiles!receiver_profile_id(id, company_name, contact_name, profile_image, verification_status)
`;

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const supabase = createServerQueryClient();
  const { data, error } = await supabase
    .from('quotations')
    .select(QUOTATION_QUERY)
    .eq('id', params.id)
    .is('deleted_at', null)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!data) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }

  const quotation = data as unknown as Quotation;

  try {
    const buffer = await renderToBuffer(<QuotationDocument quotation={quotation} />);
    const docNumber = `Q-${quotation.id.slice(0, 8).toUpperCase()}`;
    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="${docNumber}.pdf"`,
        'Cache-Control': 'private, no-cache',
      },
    });
  } catch (err) {
    console.error('[pdf/quotation]', err);
    return NextResponse.json({ error: 'pdf_generation_failed' }, { status: 500 });
  }
}
