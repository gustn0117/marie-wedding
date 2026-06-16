import { ImageResponse } from 'next/og';
import { createServerQueryClient } from '@/lib/supabase/server-query';

export const runtime = 'nodejs';
export const alt = 'Marié 공고';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

interface Props {
  params: { id: string };
}

export default async function Image({ params }: Props) {
  const supabase = createServerQueryClient();
  const { data: job } = await supabase
    .from('jobs')
    .select('title, business_type, region, author:profiles!author_id(company_name, contact_name)')
    .eq('id', params.id)
    .is('deleted_at', null)
    .single();

  const title = job?.title ?? '마리에';
  const authorAny = (job as { author?: { company_name?: string | null; contact_name?: string | null } } | null)?.author ?? null;
  const company = authorAny?.company_name || authorAny?.contact_name || '';
  const tag = '채용';

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
        <div style={{ fontSize: 28, fontWeight: 700, letterSpacing: 1 }}>Marié · {tag}</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ fontSize: 60, fontWeight: 800, lineHeight: 1.2 }}>{title}</div>
          <div style={{ fontSize: 28, color: '#6b7280' }}>{company}</div>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 22, color: '#374151' }}>
          <span>marie-wedding.hsweb.pics</span>
          <span>웨딩업계 구인구직 플랫폼</span>
        </div>
      </div>
    ),
    { ...size },
  );
}
