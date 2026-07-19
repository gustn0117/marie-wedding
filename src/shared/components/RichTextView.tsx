import { sanitizeRichHtml } from '@/shared/utils/sanitizeRichHtml';

interface RichTextViewProps {
  html: string;
  className?: string;
}

export default function RichTextView({ html, className = '' }: RichTextViewProps) {
  const safe = sanitizeRichHtml(html);
  return (
    <div
      className={`rich-text-content ${className}`}
      dangerouslySetInnerHTML={{ __html: safe }}
    />
  );
}
