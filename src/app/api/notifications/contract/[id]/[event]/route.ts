import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerQueryClient } from '@/lib/supabase/server-query';
import { sendEmail } from '@/features/notifications/lib/email';
import { contractSignedEmail, contractSignatureRequestEmail } from '@/features/notifications/lib/templates';

export const dynamic = 'force-dynamic';

const ALLOWED = ['signature_request', 'signed'] as const;
type ContractEvent = (typeof ALLOWED)[number];

export async function POST(_req: Request, { params }: { params: { id: string; event: string } }) {
  if (!ALLOWED.includes(params.event as ContractEvent)) {
    return NextResponse.json({ error: 'invalid_event' }, { status: 400 });
  }
  const event = params.event as ContractEvent;

  const cookieStore = await cookies();
  const profileCookie = cookieStore.get('marie_profile')?.value;
  if (!profileCookie) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  let callerId: string;
  try { callerId = JSON.parse(profileCookie).id; if (!callerId) throw new Error(); }
  catch { return NextResponse.json({ error: 'invalid_session' }, { status: 401 }); }

  const supabase = createServerQueryClient();
  const { data, error } = await supabase
    .from('contracts')
    .select(`
      id, title, total_amount, event_date, status,
      party_a_profile_id, party_b_profile_id, party_a_org_name, party_b_org_name,
      party_a:profiles!party_a_profile_id(user_id),
      party_b:profiles!party_b_profile_id(user_id),
      signatures:contract_signatures(signer_side)
    `)
    .eq('id', params.id)
    .is('deleted_at', null)
    .maybeSingle();

  if (error || !data) return NextResponse.json({ error: error?.message ?? 'not_found' }, { status: 404 });
  if (callerId !== data.party_a_profile_id && callerId !== data.party_b_profile_id) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  const { createServiceClient } = await import('@/lib/supabase/service');
  const svc = createServiceClient();
  async function getEmail(userId: string | null | undefined): Promise<string | null> {
    if (!userId) return null;
    const { data: u } = await svc.auth.admin.getUserById(userId);
    return u?.user?.email ?? null;
  }

  const partyA = Array.isArray(data.party_a) ? data.party_a[0] : data.party_a;
  const partyB = Array.isArray(data.party_b) ? data.party_b[0] : data.party_b;

  if (event === 'signature_request') {
    // 양방 모두에게 서명 요청 메일 (아직 서명 안 한 측만)
    const signatures = (data.signatures as { signer_side: 'party_a' | 'party_b' }[]) ?? [];
    const partyASigned = signatures.some((s) => s.signer_side === 'party_a');
    const partyBSigned = signatures.some((s) => s.signer_side === 'party_b');

    const recipients: Array<{ email: string | null; name: string; counterpartyName: string }> = [];
    if (!partyASigned) {
      recipients.push({
        email: await getEmail(partyA?.user_id),
        name: data.party_a_org_name,
        counterpartyName: data.party_b_org_name,
      });
    }
    if (!partyBSigned) {
      recipients.push({
        email: await getEmail(partyB?.user_id),
        name: data.party_b_org_name,
        counterpartyName: data.party_a_org_name,
      });
    }

    const results = await Promise.all(
      recipients.filter((r) => r.email).map((r) => {
        const tpl = contractSignatureRequestEmail({
          signerName: r.name,
          counterpartyName: r.counterpartyName,
          title: data.title,
          contractId: data.id,
          totalAmount: data.total_amount,
          eventDate: data.event_date,
        });
        return sendEmail({ to: r.email!, ...tpl });
      })
    );
    return NextResponse.json({ ok: true, sent: results.length });
  }

  // signed: 양 당사자 모두에게 체결 알림
  const targets = [
    { email: await getEmail(partyA?.user_id), name: data.party_a_org_name },
    { email: await getEmail(partyB?.user_id), name: data.party_b_org_name },
  ];
  const results = await Promise.all(
    targets.filter((r) => r.email).map((r) =>
      sendEmail({
        to: r.email!,
        ...contractSignedEmail({
          recipientName: r.name,
          title: data.title,
          contractId: data.id,
          totalAmount: data.total_amount,
        }),
      })
    )
  );
  return NextResponse.json({ ok: true, sent: results.length });
}
