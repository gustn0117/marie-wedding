import { SUPABASE_SERVER_URL } from '@/lib/supabase/serverUrl';
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { createServiceClient } from '@/lib/supabase/service';
import { ACCOUNT_TYPES, type AccountType } from '@/shared/constants';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const VALID_ACCOUNT_TYPES: AccountType[] = ACCOUNT_TYPES.map((t) => t.value);

export async function POST(request: Request) {
  let body: { accountType?: string; name?: string; phone?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }

  const accountType = body.accountType as AccountType | undefined;
  const name = (body.name ?? '').trim();
  const phone = (body.phone ?? '').trim().replace(/-/g, '');

  if (!accountType || !VALID_ACCOUNT_TYPES.includes(accountType)) {
    return NextResponse.json({ error: '계정 유형을 선택해주세요.' }, { status: 400 });
  }
  if (name.length < 2 || name.length > 40) {
    return NextResponse.json({ error: '이름 또는 회사명을 2자 이상 입력해주세요.' }, { status: 400 });
  }
  if (!/^010\d{7,8}$/.test(phone)) {
    return NextResponse.json({ error: '휴대폰 번호 형식을 확인해주세요.' }, { status: 400 });
  }

  const cookieStore = await cookies();
  const supabase = createServerClient(
    SUPABASE_SERVER_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name: n, value, options }) =>
            cookieStore.set(n, value, options),
          );
        },
      },
    },
  );

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const service = createServiceClient();
  const updates: Record<string, unknown> = {
    account_type: accountType,
    phone,
    onboarded_at: new Date().toISOString(),
  };
  if (accountType === 'business') {
    updates.company_name = name;
    updates.contact_name = name;
  } else {
    updates.contact_name = name;
  }

  const { error } = await service
    .from('profiles')
    .update(updates)
    .eq('user_id', user.id);

  if (error) {
    return NextResponse.json({ error: '저장에 실패했습니다.' }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
