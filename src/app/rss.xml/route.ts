import { createServerQueryClient } from '@/lib/supabase/server-query';
import { LANDINGS, guideDateIso } from '@/features/seo/landings';
import { SITE_URL, SITE_NAME, SITE_NAME_KO, toPlainText } from '@/shared/seo';

export const dynamic = 'force-dynamic';

// 공고·커뮤니티·행사(DB)와 채용 가이드(코드)를 날짜순으로 섞는다. 가이드가 많아 넉넉히 둔다.
const FEED_ITEMS = 120;

type FeedItem = { title: string; path: string; date: string | null; summary: string };

function xmlEscape(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function rfc822(date: string | null): string {
  const d = date ? new Date(date) : new Date();
  return (Number.isNaN(d.getTime()) ? new Date() : d).toUTCString();
}

export async function GET() {
  const supabase = createServerQueryClient();
  const items: FeedItem[] = [];

  try {
    const [jobs, posts, events] = await Promise.all([
      supabase
        .from('jobs')
        .select('id, title, description, created_at')
        .is('deleted_at', null)
        .eq('posting_type', 'hiring')
        .eq('hidden_by_admin', false)
        .neq('status', 'hidden')
        .order('created_at', { ascending: false })
        .limit(30),
      supabase
        .from('posts')
        .select('id, title, content, created_at')
        .is('deleted_at', null)
        .order('created_at', { ascending: false })
        .limit(30),
      supabase
        .from('events')
        .select('id, title, content, created_at')
        .is('deleted_at', null)
        .order('created_at', { ascending: false })
        .limit(20),
    ]);

    for (const j of jobs.data ?? []) {
      items.push({ title: `[채용] ${j.title}`, path: `/jobs/${j.id}`, date: j.created_at, summary: toPlainText(j.description, 300) });
    }
    for (const p of posts.data ?? []) {
      items.push({ title: `[커뮤니티] ${p.title}`, path: `/community/${p.id}`, date: p.created_at, summary: toPlainText(p.content, 300) });
    }
    for (const e of events.data ?? []) {
      items.push({ title: `[행사] ${e.title}`, path: `/events/${e.id}`, date: e.created_at, summary: toPlainText(e.content, 300) });
    }
  } catch {
    // DB 문제 시 빈 피드라도 유효한 XML 반환
  }

  // 채용 가이드 — 서치어드바이저에 RSS 를 제출하면 새 가이드·고친 가이드를 빨리 수집해 간다.
  // 날짜는 마지막 수정일(updatedAt)로 둬 내용을 고친 가이드도 다시 앞으로 온다.
  for (const g of LANDINGS) {
    items.push({ title: `[채용 가이드] ${g.h1}`, path: `/guide/${g.slug}`, date: guideDateIso(g.updatedAt), summary: g.description });
  }

  items.sort((a, b) => new Date(b.date ?? 0).getTime() - new Date(a.date ?? 0).getTime());
  const top = items.slice(0, FEED_ITEMS);
  const lastBuild = rfc822(top[0]?.date ?? null);

  const itemsXml = top
    .map((it) => {
      const url = `${SITE_URL}${it.path}`;
      return `    <item>
      <title>${xmlEscape(it.title)}</title>
      <link>${url}</link>
      <guid isPermaLink="true">${url}</guid>
      <pubDate>${rfc822(it.date)}</pubDate>
      <description>${xmlEscape(it.summary)}</description>
    </item>`;
    })
    .join('\n');

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${xmlEscape(`${SITE_NAME_KO} ${SITE_NAME} — 웨딩 업계 채용·소식`)}</title>
    <link>${SITE_URL}</link>
    <atom:link href="${SITE_URL}/rss.xml" rel="self" type="application/rss+xml" />
    <description>${xmlEscape('웨딩 업계 최신 채용 공고와 채용 가이드, 커뮤니티 글, 행사·박람회 소식')}</description>
    <language>ko</language>
    <lastBuildDate>${lastBuild}</lastBuildDate>
${itemsXml}
  </channel>
</rss>`;

  return new Response(xml, {
    headers: {
      'Content-Type': 'application/rss+xml; charset=utf-8',
      'Cache-Control': 'public, max-age=600, s-maxage=600',
    },
  });
}
