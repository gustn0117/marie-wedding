export interface JobFormData {
  postingType: string;
  title: string;
  description: string;
  businessType: string;
  employmentType: string;
  region: string;
  salaryInfo: string;
  salaryMin?: number | null;
  salaryMax?: number | null;
  salaryUnit?: 'monthly' | 'yearly' | 'daily' | 'hourly';
  experienceMin?: number | null;
  deadline: string;
  image?: string | null;
  /** 추가 사진(갤러리) storage 경로 목록 — 최대 8장, 사용자가 정한 순서 */
  images?: string[] | null;
}

export interface JobFilters {
  postingType?: string;
  businessType?: string;
  employmentType?: string;
  region?: string;
  search?: string;
  authorId?: string;
}
