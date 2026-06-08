import { ImageResponse } from 'next/og';
import { createServerQueryClient } from '@/lib/supabase/server-query';

export const runtime = 'nodejs';
export const alt = 'Marié 업체';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

interface Props {
  params: { id: string };
}

export default async function Image({ params }: Props) {
  const supabase = createServerQueryClient();
  const { data: profile } = await supabase
    .from('profiles')
    .select('company_name, contact_name, business_type, region, verification_status, completed_deals_count')
    .eq('id', params.id)
    .is('deleted_at', null)
    .single();

  const name = profile?.company_name || profile?.contact_name || '마리에 업체';
  const verified = profile?.verification_status === 'verified';

  return new ImageResponse(
    (
      <div
        style={{
          height: '100%',
          width: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          padding: '64px',
          background: '#ffffff',
          color: '#0b1f3a',
          fontFamily: 'system-ui, sans-serif',
        }}
      >
        <div style={{ fontSize: 28, fontWeight: 700, letterSpacing: 1 }}>Marié · 디렉토리</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <div style={{ fontSize: 60, fontWeight: 800, lineHeight: 1.1 }}>{name}</div>
            {verified && (
              <span style={{
                fontSize: 22, fontWeight: 800, padding: '6px 14px',
                border: '3px solid #0b1f3a', borderRadius: 6,
              }}>[인증]</span>
            )}
          </div>
          <div style={{ fontSize: 26, color: '#6b7280' }}>
            거래 완료 {profile?.completed_deals_count ?? 0}건
          </div>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 22, color: '#374151' }}>
          <span>marie-wedding.hsweb.pics</span>
          <span>웨딩업계 B2B 네트워킹 플랫폼</span>
        </div>
      </div>
    ),
    { ...size },
  );
}
