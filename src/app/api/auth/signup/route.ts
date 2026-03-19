import { createClient } from '@supabase/supabase-js';
import { NextResponse, type NextRequest } from 'next/server';

const SCHEMA = 'marie_wedding';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, password, accountType, contactName, regions, businessType, companyName } = body;

    if (!email || !password || !contactName || !regions?.length) {
      return NextResponse.json({ error: '필수 항목을 모두 입력해주세요.' }, { status: 400 });
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { db: { schema: SCHEMA } }
    );

    // 1. Create auth user (auto-confirmed with admin API)
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });

    if (authError) {
      if (authError.message.includes('already been registered') || authError.message.includes('already exists')) {
        return NextResponse.json({ error: '이미 가입된 이메일입니다.' }, { status: 409 });
      }
      return NextResponse.json({ error: authError.message }, { status: 400 });
    }

    if (!authData.user) {
      return NextResponse.json({ error: '회원가입에 실패했습니다.' }, { status: 500 });
    }

    // 2. Create profile (bypasses RLS with service_role)
    const profileData: Record<string, unknown> = {
      user_id: authData.user.id,
      account_type: accountType || 'individual',
      contact_name: contactName,
      region: Array.isArray(regions) ? regions.join(',') : regions,
    };

    if (accountType === 'business') {
      profileData.business_type = businessType;
      profileData.company_name = companyName;
    }

    const { error: profileError } = await supabase.from('profiles').insert(profileData);

    if (profileError) {
      // Cleanup: delete the auth user if profile creation fails
      await supabase.auth.admin.deleteUser(authData.user.id);
      return NextResponse.json({ error: `프로필 생성 실패: ${profileError.message}` }, { status: 500 });
    }

    return NextResponse.json({ success: true, userId: authData.user.id });
  } catch (err) {
    const message = err instanceof Error ? err.message : '서버 오류가 발생했습니다.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
