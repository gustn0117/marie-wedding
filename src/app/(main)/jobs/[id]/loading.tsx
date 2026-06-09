import PageSkeleton from '@/shared/components/PageSkeleton';

export default function JobDetailLoading() {
  return (
    <div className="max-w-[1200px] mx-auto">
      <PageSkeleton variant="detail" />
    </div>
  );
}
