import { createClient } from '@/lib/supabase/client';
import type { Post, Comment } from '@/types/database';
import type { PostFormData, PostFilters } from '../types';

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
        comments:comments(count)
      `,
        { count: 'exact' },
      )
      .is('deleted_at', null)
      .order('created_at', { ascending: false })
      .range(from, to);

    if (filters?.category) {
      query = query.eq('category', filters.category);
    }

    if (filters?.search) {
      query = query.or(
        `title.ilike.%${filters.search}%,content.ilike.%${filters.search}%`,
      );
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
   * Create a new post.
   */
  async createPost(data: PostFormData, authorId: string): Promise<Post> {
    const supabase = createClient();

    const { data: post, error } = await supabase
      .from('posts')
      .insert({
        title: data.title,
        content: data.content,
        category: data.category,
        author_id: authorId,
      })
      .select()
      .single();

    if (error) throw error;
    return post as Post;
  },

  /**
   * Update an existing post.
   */
  async updatePost(id: string, data: Partial<PostFormData>): Promise<Post> {
    const supabase = createClient();

    const { data: post, error } = await supabase
      .from('posts')
      .update({
        ...data,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return post as Post;
  },

  /**
   * Soft-delete a post.
   */
  async deletePost(id: string): Promise<void> {
    const supabase = createClient();

    const { error } = await supabase
      .from('posts')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', id);

    if (error) throw error;
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
    authorId: string,
  ): Promise<Comment> {
    const supabase = createClient();

    const { data, error } = await supabase
      .from('comments')
      .insert({
        post_id: postId,
        content,
        author_id: authorId,
      })
      .select('*, author:profiles!author_id(*)')
      .single();

    if (error) throw error;
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

    // 기존 좋아요 확인
    const { data: existing } = await supabase
      .from('post_likes')
      .select('id')
      .eq('post_id', postId)
      .eq('profile_id', profileId)
      .maybeSingle();

    if (existing) {
      // 좋아요 취소
      await supabase.from('post_likes').delete().eq('id', existing.id);
    } else {
      // 좋아요 추가
      await supabase.from('post_likes').insert({ post_id: postId, profile_id: profileId });
    }

    // 현재 like_count 재계산
    const { count } = await supabase
      .from('post_likes')
      .select('id', { count: 'exact', head: true })
      .eq('post_id', postId);

    const likeCount = count ?? 0;
    await supabase.from('posts').update({ like_count: likeCount }).eq('id', postId);

    return { liked: !existing, likeCount };
  },
};
