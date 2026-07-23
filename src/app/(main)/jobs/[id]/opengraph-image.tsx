import { ImageResponse } from 'next/og';
import { createServerQueryClient } from '@/lib/supabase/server-query';

export const runtime = 'nodejs';
export const alt = 'Marié 공고';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

interface Props {
  params: Promise<{ id: string }>;
}

// satori(next/og)는 자식이 2개 이상인 div 에 display:flex 를 강제한다. 이를 어기면
// 렌더가 throw 하고 응답 파이프가 끊겨 502(worker crash)가 난다. 텍스트+표현식이 섞인
// `A · {x}` 도 자식 2개로 취급되므로 항상 단일 문자열로 합치고, 만일을 대비해 전체를
// try/catch 로 감싸 어떤 데이터·렌더 오류에도 안전한 폴백 이미지를 반환한다.
export default async function Image({ params }: Props) {
  try {
    const { id } = await params;
    const supabase = createServerQueryClient();
    const { data: job } = await supabase
      .from('jobs')
      .select('title, business_type, region, author:profiles!author_id(company_name, contact_name)')
      .eq('id', id)
      .is('deleted_at', null)
      .eq('hidden_by_admin', false)
      .neq('status', 'hidden')
      .single();

    const title = job?.title ?? '마리에';
    const authorAny = (job as { author?: { company_name?: string | null; contact_name?: string | null } } | null)?.author ?? null;
    const company = authorAny?.company_name || authorAny?.contact_name || '';

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
          <div style={{ fontSize: 28, fontWeight: 700, letterSpacing: 1 }}>{'Marié · 채용'}</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ fontSize: 60, fontWeight: 800, lineHeight: 1.2 }}>{title}</div>
            <div style={{ fontSize: 28, color: '#6b7280' }}>{company}</div>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 22, color: '#374151' }}>
            <span>marie.co.kr</span>
            <span>웨딩업계 구인구직 플랫폼</span>
          </div>
        </div>
      ),
      { ...size },
    );
  } catch {
    return fallbackOgImage();
  }
}

/** 데이터·렌더 오류 시에도 502 대신 반환하는 최소 안전 이미지(단일 자식). */
function fallbackOgImage() {
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
