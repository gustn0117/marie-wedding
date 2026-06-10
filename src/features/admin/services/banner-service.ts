import { createClient } from '@/lib/supabase/client';

export interface Banner {
  id: string;
  title: string;
  image_path_pc: string | null;
  image_path_mobile: string | null;
  link_url: string | null;
  display_order: number;
  is_active: boolean;
  valid_from: string | null;
  valid_until: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface BannerInput {
  title: string;
  image_path_pc?: string | null;
  image_path_mobile?: string | null;
  link_url?: string | null;
  display_order?: number;
  is_active?: boolean;
  valid_from?: string | null;
  valid_until?: string | null;
}

export const bannerService = {
  async listAll(): Promise<Banner[]> {
    const supabase = createClient();
    const { data, error } = await supabase
      .from('banners')
      .select('*')
      .is('deleted_at', null)
      .order('display_order', { ascending: true })
      .order('created_at', { ascending: false });
    if (error) throw new Error(error.message);
    return (data ?? []) as Banner[];
  },

  async create(input: BannerInput): Promise<Banner> {
    const supabase = createClient();
    const { data, error } = await supabase.from('banners').insert(input).select().single();
    if (error) throw new Error(error.message);
    return data as Banner;
  },

  async update(id: string, input: Partial<BannerInput>): Promise<Banner> {
    const supabase = createClient();
    const { data, error } = await supabase.from('banners').update(input).eq('id', id).select().single();
    if (error) throw new Error(error.message);
    return data as Banner;
  },

  async softDelete(id: string): Promise<void> {
    const supabase = createClient();
    const { error } = await supabase.from('banners').update({ deleted_at: new Date().toISOString() }).eq('id', id);
    if (error) throw new Error(error.message);
  },

  async uploadImage(file: File, kind: 'pc' | 'mobile'): Promise<string> {
    const supabase = createClient();
    const ext = file.name.split('.').pop() || 'jpg';
    const path = `${kind}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
    const { error } = await supabase.storage.from('banners').upload(path, file, { upsert: false });
    if (error) throw new Error(`업로드 실패: ${error.message}`);
    return path;
  },

  publicUrl(path: string): string {
    return `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/banners/${path}`;
  },
};
