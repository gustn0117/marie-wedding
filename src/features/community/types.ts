export interface PostFormData {
  title: string;
  content: string;
  category: string;
}

export interface CommentFormData {
  content: string;
}

export interface PostFilters {
  category?: string;
  search?: string;
}
