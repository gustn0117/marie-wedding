import { NextResponse, type NextRequest } from 'next/server';
import { createServiceClient } from '@/lib/supabase/service';
import { validateEmail } from '@/shared/utils/validation';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, password, accountType, contactName, regions, businessTypes, companyName } = body;

    if (!email || !password || !contactName || !regions?.length) {
      return NextResponse.json({ error: '필수 항목을 모두 입력해주세요.' }, { status: 400 });
    }

    // 이메일 형식 검증 (서버 측 — 클라이언트 우회 방지)
    const emailCheck = validateEmail(email);
    if (!emailCheck.valid) {
      return NextResponse.json({ error: emailCheck.reason ?? '이메일 형식이 올바르지 않습니다.' }, { status: 400 });
    }

    const supabase = createServiceClient();

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
    //    이메일 회원가입은 폼에서 이미 account_type / regions를 받았으므로 곧장 onboarded 상태로 저장.
    //    그러지 않으면 미들웨어가 마이페이지 진입 시 /onboarding으로 다시 보내 사용자가 동일 질문을 다시 받음.
    const profileData: Record<string, unknown> = {
      user_id: authData.user.id,
      account_type: accountType || 'individual',
      contact_name: contactName,
      region: Array.isArray(regions) ? regions.join(',') : regions,
      signup_provider: 'email',
      onboarded_at: new Date().toISOString(),
    };

    if (accountType === 'business') {
      profileData.business_type = Array.isArray(businessTypes) ? businessTypes.join(',') : businessTypes;
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
