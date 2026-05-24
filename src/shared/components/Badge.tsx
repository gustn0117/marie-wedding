import { LabelKind, labelClass } from '@/shared/utils/labels';

interface BadgeProps {
  kind: LabelKind;
  children: React.ReactNode;
  className?: string;
}

export default function Badge({ kind, children, className = '' }: BadgeProps) {
  return (
    <span className={`${labelClass(kind)} ${className}`}>
      {children}
    </span>
  );
}
