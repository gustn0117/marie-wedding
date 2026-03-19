import { createClient } from '@/lib/supabase/client';
import type { Profile, Job, Post, Comment } from '@/types/database';

const PAGE_SIZE = 20;

export const adminService = {
  // ── Dashboard Stats ──
  async getStats(): Promise<{
    users: number;
    jobs: number;
    posts: number;
    comments: number;
    recentUsers: number;
    recentJobs: number;
  }> {
    const supabase = createClient();

    const [users, jobs, posts, comments, recentUsers, recentJobs] = await Promise.all([
      supabase.from('profiles').select('*', { count: 'exact', head: true }).is('deleted_at', null),
      supabase.from('jobs').select('*', { count: 'exact', head: true }).is('deleted_at', null),
      supabase.from('posts').select('*', { count: 'exact', head: true }).is('deleted_at', null),
      supabase.from('comments').select('*', { count: 'exact', head: true }).is('deleted_at', null),
      supabase.from('profiles').select('*', { count: 'exact', head: true })
        .is('deleted_at', null)
        .gte('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()),
      supabase.from('jobs').select('*', { count: 'exact', head: true })
        .is('deleted_at', null)
        .gte('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()),
    ]);

    return {
      users: users.count ?? 0,
      jobs: jobs.count ?? 0,
      posts: posts.count ?? 0,
      comments: comments.count ?? 0,
      recentUsers: recentUsers.count ?? 0,
      recentJobs: recentJobs.count ?? 0,
    };
  },

  // ── Users ──
  async getUsers(
    page = 1,
    search?: string,
    showDeleted = false,
  ): Promise<{ data: Profile[]; count: number }> {
    const supabase = createClient();
    const from = (page - 1) * PAGE_SIZE;

    let query = supabase
      .from('profiles')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(from, from + PAGE_SIZE - 1);

    if (!showDeleted) query = query.is('deleted_at', null);
    if (search) {
      query = query.or(`contact_name.ilike.%${search}%,company_name.ilike.%${search}%`);
    }

    const { data, count, error } = await query;
    if (error) throw error;
    return { data: (data as Profile[]) ?? [], count: count ?? 0 };
  },

  async updateUserRole(id: string, role: 'user' | 'admin'): Promise<void> {
    const supabase = createClient();
    const { error } = await supabase.from('profiles').update({ role }).eq('id', id);
    if (error) throw error;
  },

  async softDeleteUser(id: string): Promise<void> {
    const supabase = createClient();
    const { error } = await supabase
      .from('profiles')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', id);
    if (error) throw error;
  },

  async restoreUser(id: string): Promise<void> {
    const supabase = createClient();
    const { error } = await supabase
      .from('profiles')
      .update({ deleted_at: null })
      .eq('id', id);
    if (error) throw error;
  },

  // ── Jobs ──
  async getJobs(
    page = 1,
    search?: string,
    showDeleted = false,
  ): Promise<{ data: Job[]; count: number }> {
    const supabase = createClient();
    const from = (page - 1) * PAGE_SIZE;

    let query = supabase
      .from('jobs')
      .select('*, author:profiles!author_id(*)', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(from, from + PAGE_SIZE - 1);

    if (!showDeleted) query = query.is('deleted_at', null);
    if (search) query = query.ilike('title', `%${search}%`);

    const { data, count, error } = await query;
    if (error) throw error;
    return { data: (data as Job[]) ?? [], count: count ?? 0 };
  },

  async softDeleteJob(id: string): Promise<void> {
    const supabase = createClient();
    const { error } = await supabase
      .from('jobs')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', id);
    if (error) throw error;
  },

  async restoreJob(id: string): Promise<void> {
    const supabase = createClient();
    const { error } = await supabase
      .from('jobs')
      .update({ deleted_at: null })
      .eq('id', id);
    if (error) throw error;
  },

  // ── Posts ──
  async getPosts(
    page = 1,
    search?: string,
    showDeleted = false,
  ): Promise<{ data: Post[]; count: number }> {
    const supabase = createClient();
    const from = (page - 1) * PAGE_SIZE;

    let query = supabase
      .from('posts')
      .select('*, author:profiles!author_id(*), comments:comments(count)', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(from, from + PAGE_SIZE - 1);

    if (!showDeleted) query = query.is('deleted_at', null);
    if (search) query = query.ilike('title', `%${search}%`);

    const { data, count, error } = await query;
    if (error) throw error;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const posts = (data ?? []).map((row: any) => ({
      ...row,
      comment_count: row.comments?.[0]?.count ?? 0,
    })) as Post[];

    return { data: posts, count: count ?? 0 };
  },

  async softDeletePost(id: string): Promise<void> {
    const supabase = createClient();
    const { error } = await supabase
      .from('posts')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', id);
    if (error) throw error;
  },

  async restorePost(id: string): Promise<void> {
    const supabase = createClient();
    const { error } = await supabase
      .from('posts')
      .update({ deleted_at: null })
      .eq('id', id);
    if (error) throw error;
  },

  // ── Comments ──
  async getComments(
    page = 1,
    search?: string,
    showDeleted = false,
  ): Promise<{ data: (Comment & { post?: Post })[]; count: number }> {
    const supabase = createClient();
    const from = (page - 1) * PAGE_SIZE;

    let query = supabase
      .from('comments')
      .select('*, author:profiles!author_id(*), post:posts!post_id(id, title)', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(from, from + PAGE_SIZE - 1);

    if (!showDeleted) query = query.is('deleted_at', null);
    if (search) query = query.ilike('content', `%${search}%`);

    const { data, count, error } = await query;
    if (error) throw error;
    return { data: (data ?? []) as (Comment & { post?: Post })[], count: count ?? 0 };
  },

  async softDeleteComment(id: string): Promise<void> {
    const supabase = createClient();
    const { error } = await supabase
      .from('comments')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', id);
    if (error) throw error;
  },

  async restoreComment(id: string): Promise<void> {
    const supabase = createClient();
    const { error } = await supabase
      .from('comments')
      .update({ deleted_at: null })
      .eq('id', id);
    if (error) throw error;
  },

  // ── Recent items for dashboard ──
  async getRecentUsers(limit = 5): Promise<Profile[]> {
    const supabase = createClient();
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .is('deleted_at', null)
      .order('created_at', { ascending: false })
      .limit(limit);
    if (error) throw error;
    return (data as Profile[]) ?? [];
  },

  async getRecentJobs(limit = 5): Promise<Job[]> {
    const supabase = createClient();
    const { data, error } = await supabase
      .from('jobs')
      .select('*, author:profiles!author_id(*)')
      .is('deleted_at', null)
      .order('created_at', { ascending: false })
      .limit(limit);
    if (error) throw error;
    return (data as Job[]) ?? [];
  },
};
