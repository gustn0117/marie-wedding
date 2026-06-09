import PageSkeleton from '@/shared/components/PageSkeleton';

export default function AdminLoading() {
  return (
    <div className="p-4 lg:p-8">
      <PageSkeleton variant="list" />
    </div>
  );
}
