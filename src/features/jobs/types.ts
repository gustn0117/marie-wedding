export interface JobFormData {
  postingType: string;
  title: string;
  description: string;
  businessType: string;
  employmentType: string;
  region: string;
  salaryInfo: string;
  isUrgent: boolean;
  deadline: string;
}

export interface JobFilters {
  postingType?: string;
  businessType?: string;
  employmentType?: string;
  region?: string;
  search?: string;
}
