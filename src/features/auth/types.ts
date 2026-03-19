export interface SignupFormData {
  email: string;
  password: string;
  confirmPassword: string;
  businessType: string;
  companyName: string;
  contactName: string;
  region: string;
}

export interface LoginFormData {
  email: string;
  password: string;
}
