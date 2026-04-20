export interface EventFormData {
  title: string;
  content: string;
  type: 'event' | 'news' | 'notice';
  image: string | null;
  start_date: string;
  end_date: string;
  location: string;
  link_url: string;
  is_pinned: boolean;
}

export const EVENT_TYPES = [
  { value: 'event', label: '이벤트' },
  { value: 'news', label: '소식' },
  { value: 'notice', label: '공지' },
] as const;
