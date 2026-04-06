export interface SignupFormData {
  accountType: 'individual' | 'business';
  email: string;
  password: string;
  confirmPassword: string;
  // 공통
  contactName: string;
  regions: string[];
  // 업체 전용
  businessTypes: string[];
  companyName?: string;
}

export interface LoginFormData {
  email: string;
  password: string;
}
