import { NextResponse, type NextRequest } from 'next/server';
import { isAdminRequest } from '@/lib/admin-auth';
import { createServiceClient } from '@/lib/supabase/service';

function unauthorized() {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { password, action, ...params } = body;

  if (!(await isAdminRequest(password))) return unauthorized();

  const supabase = createServiceClient();

  try {
    switch (action) {
      case 'ping':
        return NextResponse.json({ success: true });

      // ── Stats ──
      case 'getStats': {
        const now = new Date();
        const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();

        const [users, jobs, posts, comments, reports, recentUsers, recentJobs] = await Promise.all([
          supabase.from('profiles').select('*', { count: 'exact', head: true }).is('deleted_at', null),
          supabase.from('jobs').select('*', { count: 'exact', head: true }).is('deleted_at', null),
          supabase.from('posts').select('*', { count: 'exact', head: true }).is('deleted_at', null),
          supabase.from('comments').select('*', { count: 'exact', head: true }).is('deleted_at', null),
          supabase.from('reports').select('*', { count: 'exact', head: true }).eq('status', 'open'),
          supabase.from('profiles').select('*', { count: 'exact', head: true }).is('deleted_at', null).gte('created_at', weekAgo),
          supabase.from('jobs').select('*', { count: 'exact', head: true }).is('deleted_at', null).gte('created_at', weekAgo),
        ]);

        return NextResponse.json({
          users: users.count ?? 0,
          jobs: jobs.count ?? 0,
          posts: posts.count ?? 0,
          comments: comments.count ?? 0,
          reports: reports.count ?? 0,
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

      // ── Reports ──
      case 'getReports': {
        const { page = 1, status } = params;
        const pageSize = 20;
        const from = (page - 1) * pageSize;

        let query = supabase
          .from('reports')
          .select('*, reporter:profiles!reporter_id(*)', { count: 'exact' })
          .order('created_at', { ascending: false })
          .range(from, from + pageSize - 1);

        if (status) query = query.eq('status', status);

        const { data, count, error } = await query;
        if (error) throw error;
        return NextResponse.json({ data: data ?? [], count: count ?? 0 });
      }

      case 'updateReportStatus': {
        const { data, error } = await supabase
          .from('reports')
          .update({ status: params.status })
          .eq('id', params.id)
          .select('*, reporter:profiles!reporter_id(*)')
          .single();
        if (error) throw error;
        return NextResponse.json(data);
      }

      // ── Events ──
      case 'getEvents': {
        const { page = 1, search, type, showDeleted = false } = params;
        const pageSize = 20;
        const from = (page - 1) * pageSize;

        let query = supabase
          .from('events')
          .select('*', { count: 'exact' })
          .order('is_pinned', { ascending: false })
          .order('created_at', { ascending: false })
          .range(from, from + pageSize - 1);

        if (!showDeleted) query = query.is('deleted_at', null);
        if (type) query = query.eq('type', type);
        if (search) query = query.or(`title.ilike.%${search}%,content.ilike.%${search}%`);

        const { data, count, error } = await query;
        if (error) throw error;
        return NextResponse.json({ data: data ?? [], count: count ?? 0 });
      }

      case 'getEvent': {
        const { data, error } = await supabase
          .from('events')
          .select('*')
          .eq('id', params.id)
          .single();
        if (error) throw error;
        return NextResponse.json(data);
      }

      case 'createEvent': {
        const { data, error } = await supabase
          .from('events')
          .insert({
            title: params.title,
            content: params.content,
            type: params.type,
            image: params.image || null,
            start_date: params.start_date || null,
            end_date: params.end_date || null,
            location: params.location || null,
            link_url: params.link_url || null,
            is_pinned: !!params.is_pinned,
          })
          .select()
          .single();
        if (error) throw error;
        return NextResponse.json(data);
      }

      case 'updateEvent': {
        const payload: Record<string, unknown> = { updated_at: new Date().toISOString() };
        if (params.title !== undefined) payload.title = params.title;
        if (params.content !== undefined) payload.content = params.content;
        if (params.type !== undefined) payload.type = params.type;
        if (params.image !== undefined) payload.image = params.image || null;
        if (params.start_date !== undefined) payload.start_date = params.start_date || null;
        if (params.end_date !== undefined) payload.end_date = params.end_date || null;
        if (params.location !== undefined) payload.location = params.location || null;
        if (params.link_url !== undefined) payload.link_url = params.link_url || null;
        if (params.is_pinned !== undefined) payload.is_pinned = !!params.is_pinned;

        const { data, error } = await supabase
          .from('events')
          .update(payload)
          .eq('id', params.id)
          .select()
          .single();
        if (error) throw error;
        return NextResponse.json(data);
      }

      case 'softDeleteEvent': {
        const { error } = await supabase.from('events').update({ deleted_at: new Date().toISOString() }).eq('id', params.id);
        if (error) throw error;
        return NextResponse.json({ success: true });
      }

      case 'restoreEvent': {
        const { error } = await supabase.from('events').update({ deleted_at: null }).eq('id', params.id);
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
