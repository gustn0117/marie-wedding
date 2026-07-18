import { ImageResponse } from 'next/og';
import { createServerQueryClient } from '@/lib/supabase/server-query';

export const runtime = 'nodejs';
export const alt = 'Marié 업체';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

interface Props {
  params: Promise<{ id: string }>;
}

// satori 규칙: 자식 2개 이상 div 는 display:flex 필수. `진행 완료 {n}건` 처럼 텍스트+표현식이
// 섞이면 자식 여러 개로 취급돼 렌더가 throw → 502. 항상 단일 문자열로 합치고 try/catch 폴백.
export default async function Image({ params }: Props) {
  try {
    const { id } = await params;
    const supabase = createServerQueryClient();
    const { data: profile } = await supabase
      .from('profiles')
      .select('company_name, contact_name, business_type, region, completed_deals_count')
      .eq('id', id)
      .is('deleted_at', null)
      .single();

    const name = profile?.company_name || profile?.contact_name || '마리에 업체';
    const deals = `진행 완료 ${profile?.completed_deals_count ?? 0}건`;

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
            fontFamily: 'sans-serif',
          }}
        >
          <div style={{ fontSize: 28, fontWeight: 700, letterSpacing: 1 }}>Marié · 디렉토리</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              <div style={{ fontSize: 60, fontWeight: 800, lineHeight: 1.1 }}>{name}</div>
            </div>
            <div style={{ fontSize: 26, color: '#6b7280' }}>{deals}</div>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 22, color: '#374151' }}>
            <span>marie-wedding.hsweb.pics</span>
            <span>웨딩업계 구인구직 플랫폼</span>
          </div>
        </div>
      ),
      { ...size },
    );
  } catch {
    return new ImageResponse(
      (
        <div
          style={{
            height: '100%',
            width: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: '#051049',
            color: '#ffffff',
            fontSize: 96,
            fontWeight: 800,
            fontFamily: 'sans-serif',
          }}
        >
          Marié
        </div>
      ),
      { width: 1200, height: 630 },
    );
  }
}
