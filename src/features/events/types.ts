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
  { value: 'event', label: '웨딩박람회' },
  { value: 'news', label: '채용행사' },
  { value: 'notice', label: '업계소식' },
] as const;

export const EVENT_TYPE_DESCRIPTIONS: Record<EventFormData['type'], string> = {
  event: '웨딩박람회, 웨딩페어, 브랜드 쇼케이스 등 오프라인 행사',
  news: '채용설명회, 교육 후 채용, 박람회 스태프 모집과 연결되는 행사',
  notice: '웨딩업계 일정, 운영 공지, 행사 모집 안내',
};
