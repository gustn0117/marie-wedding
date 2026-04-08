export interface JobFormData {
  postingType: string;
  title: string;
  description: string;
  businessType: string;
  employmentType: string;
  region: string;
  salaryInfo: string;
  deadline: string;
  image?: string | null;
}

export interface JobFilters {
  postingType?: string;
  businessType?: string;
  employmentType?: string;
  region?: string;
  search?: string;
  authorId?: string;
}
