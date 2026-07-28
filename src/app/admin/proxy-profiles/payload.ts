import type { DirectoryFormValues } from '@/features/directory/components/DirectoryForm';
import type { Profile } from '@/types/database';
import type { ProxyMeta } from './ProxyMetaPanel';

/** 폼 값 → 관리자 API 등재 본문. 대행 등록·회원 프로필 수정이 같은 모양을 쓴다. */
export function toListingPayload(values: DirectoryFormValues) {
  return {
    companyName: values.company_name ?? '',
    contactName: values.contact_name,
    businessType: values.business_type ?? '',
    region: values.region,
    bio: values.bio ?? '',
    address: values.address ?? '',
    website: values.website ?? '',
    companySize: values.company_size ?? '',
    establishedYear: values.established_year ?? '',
    profileImage: values.profile_image ?? '',
    coverImage: values.cover_image ?? '',
    gallery: values.gallery ?? [],
  };
}

/** 대행 API 본문 — 등재 내용에 대행 정보(연락처·동의 기록)를 더한다. */
export function toProxyPayload(values: DirectoryFormValues, meta: ProxyMeta) {
  return {
    ...toListingPayload(values),
    proxyContact: meta.contact.trim(),
    consentNote: meta.consentNote.trim(),
  };
}

/** 등록 화면용 빈 프로필 — DirectoryForm 은 기존 값을 프로필에서 읽는다. */
export function blankProxyProfile(): Profile {
  return {
    id: '',
    user_id: null,
    account_type: 'business',
    business_type: null,
    company_name: null,
    contact_name: '',
    region: null,
    bio: null,
    phone: null,
    website: null,
    profile_image: null,
    cover_image: null,
    is_directory_listed: true,
    company_size: null,
    established_year: null,
    address: null,
    gallery: null,
  } as unknown as Profile;
}
