import { apiFetch } from '@/shared/utils/apiFetch';
import { createClient } from '@/lib/supabase/client';
import type { Post, Comment } from '@/types/database';
import type { PostFormData, PostFilters } from '../types';
import { normalizeSearchTerm } from '@/shared/utils/searchQuery';

const PAGE_SIZE_DEFAULT = 10;

export const communityService = {
  /**
   * Fetch posts with optional filters and pagination.
   * Joins author profile and includes comment count.
   */
  async getPosts(
    filters?: PostFilters,
    page: number = 1,
    pageSize: number = PAGE_SIZE_DEFAULT,
  ): Promise<{ data: Post[]; count: number }> {
    const supabase = createClient();
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    let query = supabase
      .from('posts')
      .select(
        `
        *,
        author:profiles!author_id(*),
        comments:comments!comments_post_id_fkey(count)
      `,
        { count: 'exact' },
      )
      .is('deleted_at', null)
      // 삭제된 댓글은 카운트에서 제외 (embedded filter)
      .filter('comments.deleted_at', 'is', null)
      .order('created_at', { ascending: false })
      .range(from, to);

    if (filters?.category) {
      query = query.eq('category', filters.category);
    }

    if (filters?.search) {
      const term = normalizeSearchTerm(filters.search);
      if (term) {
        query = query.or(`title.ilike.%${term}%,content.ilike.%${term}%`);
      }
    }

    if (filters?.authorId) {
      query = query.eq('author_id', filters.authorId);
    }

    const { data, error, count } = await query;

    if (error) throw error;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const posts = (data ?? []).map((row: any) => {
      const { comments: commentAgg, ...rest } = row;
      return {
        ...rest,
        author: row.author,
        comment_count: commentAgg?.[0]?.count ?? 0,
      } as Post;
    });

    return { data: posts, count: count ?? 0 };
  },

  /**
   * Fetch a single post by ID with author profile.
   * Increments view_count atomically.
   */
  async getPostById(id: string): Promise<Post> {
    const supabase = createClient();

    // Increment view count
    await supabase.rpc('increment_view_count', { post_id: id });

    const { data, error } = await supabase
      .from('posts')
      .select('*, author:profiles!author_id(*)')
      .eq('id', id)
      .is('deleted_at', null)
      .single();

    if (error) throw error;
    return data as Post;
  },

  /**
   * Create a new post via service_role server route.
   *
   * 배경: 클라이언트 .insert().select().maybeSingle() 가 RLS readback / moderation
   *      trigger 영향으로 data=null 을 반환해 UI 가 '실패' 로 인식하지만 DB 엔
   *      저장되는 케이스가 있었음 (QA-010). 서버 라우트로 우회.
   *
   * authorId 인자는 호출자 시그니처 호환을 위해 받지만 실제 author는 서버에서 인증 쿠키로 재도출.
   */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async createPost(data: PostFormData, _authorId: string): Promise<Post> {
    const res = await apiFetch('/api/posts/create', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: data.title,
        content: data.content,
        category: data.category,
        region: data.region || null,
      }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({ error: '' }));
      throw new Error(body.error || `게시글 등록에 실패했습니다 (HTTP ${res.status}).`);
    }
    const { post } = await res.json();
    if (!post) throw new Error('게시글이 저장되었지만 응답이 비어 있어요. 게시판에서 확인해 주세요.');
    return post as Post;
  },

  /**
   * Update an existing post via service_role server route.
   * QA-010 재발 방지 — moderation 트리거 RETURNING null 이슈 우회.
   */
  async updatePost(id: string, data: Partial<PostFormData>): Promise<Post> {
    const res = await apiFetch('/api/posts/update', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id,
        title: data.title,
        content: data.content,
        category: data.category,
        region: data.region || null,
      }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({ error: '' }));
      throw new Error(body.error || `수정에 실패했습니다 (HTTP ${res.status}).`);
    }
    const { post } = await res.json();
    return post as Post;
  },

  /**
   * Soft-delete a post.
   * RLS WITH CHECK 이슈를 우회하기 위해 service_role server route 경유.
   */
  async deletePost(id: string): Promise<void> {
    const res = await apiFetch(`/api/posts/${id}/delete`, {
      method: 'POST',
      credentials: 'include',
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({ error: '' }));
      throw new Error(body.error || `게시글 삭제에 실패했습니다 (HTTP ${res.status}).`);
    }
  },

  /**
   * Fetch all comments for a post, ordered by created_at ascending.
   */
  async getComments(postId: string): Promise<Comment[]> {
    const supabase = createClient();

    const { data, error } = await supabase
      .from('comments')
      .select('*, author:profiles!author_id(*)')
      .eq('post_id', postId)
      .is('deleted_at', null)
      .order('created_at', { ascending: true });

    if (error) throw error;
    return (data ?? []) as Comment[];
  },

  /**
   * Add a comment to a post.
   */
  async createComment(
    postId: string,
    content: string,
  ): Promise<Comment> {
    // service_role 서버 라우트 경유 — 클라이언트 insert hang 회피.
    const res = await apiFetch('/api/comments/create', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ postId, content }),
    });
    if (!res.ok) {
      const b = await res.json().catch(() => ({ error: '' }));
      throw new Error(b.error || '댓글 작성에 실패했습니다.');
    }
    const { data } = await res.json();
    return data as Comment;
  },

  /**
   * Soft-delete a comment.
   */
  async deleteComment(id: string): Promise<void> {
    const supabase = createClient();

    const { error } = await supabase
      .from('comments')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', id);

    if (error) throw error;
  },

  /**
   * Toggle like on a post. Returns new like state.
   */
  async toggleLike(postId: string, profileId: string): Promise<{ liked: boolean; likeCount: number }> {
    const supabase = createClient();

    const { data, error } = await supabase
      .rpc('toggle_post_like', { p_post_id: postId, p_profile_id: profileId })
      .single();

    if (error) throw error;

    const result = data as { liked: boolean; like_count: number };
    return { liked: result.liked, likeCount: result.like_count };
  },
};
