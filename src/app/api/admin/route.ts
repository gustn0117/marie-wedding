import { createClient } from '@supabase/supabase-js';
import { NextResponse, type NextRequest } from 'next/server';

const ADMIN_PASSWORD = '1234';
const SCHEMA = 'marie_wedding';

function getServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { db: { schema: SCHEMA } }
  );
}

function unauthorized() {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { password, action, ...params } = body;

  if (password !== ADMIN_PASSWORD) return unauthorized();

  const supabase = getServiceClient();

  try {
    switch (action) {
      // ── Stats ──
      case 'getStats': {
        const now = new Date();
        const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();

        const [users, jobs, posts, comments, recentUsers, recentJobs] = await Promise.all([
          supabase.from('profiles').select('*', { count: 'exact', head: true }).is('deleted_at', null),
          supabase.from('jobs').select('*', { count: 'exact', head: true }).is('deleted_at', null),
          supabase.from('posts').select('*', { count: 'exact', head: true }).is('deleted_at', null),
          supabase.from('comments').select('*', { count: 'exact', head: true }).is('deleted_at', null),
          supabase.from('profiles').select('*', { count: 'exact', head: true }).is('deleted_at', null).gte('created_at', weekAgo),
          supabase.from('jobs').select('*', { count: 'exact', head: true }).is('deleted_at', null).gte('created_at', weekAgo),
        ]);

        return NextResponse.json({
          users: users.count ?? 0,
          jobs: jobs.count ?? 0,
          posts: posts.count ?? 0,
          comments: comments.count ?? 0,
          recentUsers: recentUsers.count ?? 0,
          recentJobs: recentJobs.count ?? 0,
        });
      }

      // ── Users ──
      case 'getUsers': {
        const { page = 1, search, showDeleted = false } = params;
        const pageSize = 20;
        const from = (page - 1) * pageSize;

        let query = supabase
          .from('profiles')
          .select('*', { count: 'exact' })
          .order('created_at', { ascending: false })
          .range(from, from + pageSize - 1);

        if (!showDeleted) query = query.is('deleted_at', null);
        if (search) query = query.or(`contact_name.ilike.%${search}%,company_name.ilike.%${search}%`);

        const { data, count, error } = await query;
        if (error) throw error;
        return NextResponse.json({ data: data ?? [], count: count ?? 0 });
      }

      case 'getRecentUsers': {
        const { data, error } = await supabase
          .from('profiles')
          .select('*')
          .is('deleted_at', null)
          .order('created_at', { ascending: false })
          .limit(params.limit ?? 5);
        if (error) throw error;
        return NextResponse.json(data ?? []);
      }

      case 'updateUserRole': {
        const { error } = await supabase.from('profiles').update({ role: params.role }).eq('id', params.id);
        if (error) throw error;
        return NextResponse.json({ success: true });
      }

      case 'softDeleteUser': {
        const { error } = await supabase.from('profiles').update({ deleted_at: new Date().toISOString() }).eq('id', params.id);
        if (error) throw error;
        return NextResponse.json({ success: true });
      }

      case 'restoreUser': {
        const { error } = await supabase.from('profiles').update({ deleted_at: null }).eq('id', params.id);
        if (error) throw error;
        return NextResponse.json({ success: true });
      }

      // ── Jobs ──
      case 'getJobs': {
        const { page = 1, search, showDeleted = false } = params;
        const pageSize = 20;
        const from = (page - 1) * pageSize;

        let query = supabase
          .from('jobs')
          .select('*, author:profiles!author_id(*)', { count: 'exact' })
          .order('created_at', { ascending: false })
          .range(from, from + pageSize - 1);

        if (!showDeleted) query = query.is('deleted_at', null);
        if (search) query = query.ilike('title', `%${search}%`);

        const { data, count, error } = await query;
        if (error) throw error;
        return NextResponse.json({ data: data ?? [], count: count ?? 0 });
      }

      case 'getRecentJobs': {
        const { data, error } = await supabase
          .from('jobs')
          .select('*, author:profiles!author_id(*)')
          .is('deleted_at', null)
          .order('created_at', { ascending: false })
          .limit(params.limit ?? 5);
        if (error) throw error;
        return NextResponse.json(data ?? []);
      }

      case 'softDeleteJob': {
        const { error } = await supabase.from('jobs').update({ deleted_at: new Date().toISOString() }).eq('id', params.id);
        if (error) throw error;
        return NextResponse.json({ success: true });
      }

      case 'restoreJob': {
        const { error } = await supabase.from('jobs').update({ deleted_at: null }).eq('id', params.id);
        if (error) throw error;
        return NextResponse.json({ success: true });
      }

      // ── Posts ──
      case 'getPosts': {
        const { page = 1, search, showDeleted = false } = params;
        const pageSize = 20;
        const from = (page - 1) * pageSize;

        let query = supabase
          .from('posts')
          .select('*, author:profiles!author_id(*), comments:comments(count)', { count: 'exact' })
          .order('created_at', { ascending: false })
          .range(from, from + pageSize - 1);

        if (!showDeleted) query = query.is('deleted_at', null);
        if (search) query = query.ilike('title', `%${search}%`);

        const { data, count, error } = await query;
        if (error) throw error;

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const posts = (data ?? []).map((row: any) => ({
          ...row,
          comment_count: row.comments?.[0]?.count ?? 0,
        }));

        return NextResponse.json({ data: posts, count: count ?? 0 });
      }

      case 'softDeletePost': {
        const { error } = await supabase.from('posts').update({ deleted_at: new Date().toISOString() }).eq('id', params.id);
        if (error) throw error;
        return NextResponse.json({ success: true });
      }

      case 'restorePost': {
        const { error } = await supabase.from('posts').update({ deleted_at: null }).eq('id', params.id);
        if (error) throw error;
        return NextResponse.json({ success: true });
      }

      // ── Comments ──
      case 'getComments': {
        const { page = 1, search, showDeleted = false } = params;
        const pageSize = 20;
        const from = (page - 1) * pageSize;

        let query = supabase
          .from('comments')
          .select('*, author:profiles!author_id(*), post:posts!post_id(id, title)', { count: 'exact' })
          .order('created_at', { ascending: false })
          .range(from, from + pageSize - 1);

        if (!showDeleted) query = query.is('deleted_at', null);
        if (search) query = query.ilike('content', `%${search}%`);

        const { data, count, error } = await query;
        if (error) throw error;
        return NextResponse.json({ data: data ?? [], count: count ?? 0 });
      }

      case 'softDeleteComment': {
        const { error } = await supabase.from('comments').update({ deleted_at: new Date().toISOString() }).eq('id', params.id);
        if (error) throw error;
        return NextResponse.json({ success: true });
      }

      case 'restoreComment': {
        const { error } = await supabase.from('comments').update({ deleted_at: null }).eq('id', params.id);
        if (error) throw error;
        return NextResponse.json({ success: true });
      }

      default:
        return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
