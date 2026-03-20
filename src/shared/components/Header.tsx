import { cookies } from 'next/headers';
import HeaderClient from './HeaderClient';

export interface AuthProfile {
  id: string;
  contact_name: string;
  company_name: string | null;
  account_type: string;
  role: string;
  region: string;
}

export default async function Header() {
  let profile: AuthProfile | null = null;

  try {
    const cookieStore = await cookies();
    const profileCookie = cookieStore.get('marie_profile');
    if (profileCookie?.value) {
      profile = JSON.parse(profileCookie.value);
    }
  } catch {}

  return <HeaderClient initialProfile={profile} />;
}
