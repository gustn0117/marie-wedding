export type LabelKind = 'urgent' | 'new' | 'promoted' | 'verified' | 'attr' | 'category';

export function labelClass(kind: LabelKind): string {
  switch (kind) {
    case 'urgent':
      return 'badge-urgent';
    case 'new':
      return 'badge-new';
    case 'promoted':
      return 'badge-promoted';
    case 'verified':
      return 'badge-verified';
    case 'attr':
      return 'badge-attr';
    case 'category':
      return 'badge-category';
  }
}
