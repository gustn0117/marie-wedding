import { cookies } from 'next/headers';
import { notFound, redirect } from 'next/navigation';
import Link from 'next/link';
import { createServerQueryClient } from '@/lib/supabase/server-query';
import { ROUTES } from '@/shared/constants';
import type { Job } from '@/types/database';
import type { JobFormData } from '@/features/jobs/types';
import JobEditForm from '@/features/jobs/components/JobEditForm';

export const dynamic = 'force-dynamic';

interface PageProps {
  params: { id: string };
}

async function getJob(id: string): Promise<Job | null> {
  const supabase = createServerQueryClient();
  const { data } = await supabase
    .from('jobs')
    .select('*, author:profiles!author_id(*)')
    .eq('id', id)
    .is('deleted_at', null)
    .single();
  return data as Job | null;
}

export default async function EditJobPage({ params }: PageProps) {
  const cookieStore = await cookies();
  const profileCookie = cookieStore.get('marie_profile');

  if (!profileCookie?.value) redirect(ROUTES.LOGIN);

  let me: { id: string } | null = null;
  try { me = JSON.parse(profileCookie.value); } catch { redirect(ROUTES.LOGIN); }
  if (!me?.id) redirect(ROUTES.LOGIN);

  const job = await getJob(params.id);
  if (!job) notFound();

  if (me.id !== job.author_id) {
    return (
      <div className="max-w-2xl mx-auto">
        <div className="bg-white rounded-xl border border-gray-200 p-8 text-center space-y-4">
          <h2 className="text-lg font-semibold text-gray-900">수정 권한이 없습니다</h2>
          <Link href={ROUTES.JOBS_DETAIL(params.id)} className="btn-outline text-sm inline-block">돌아가기</Link>
        </div>
      </div>
    );
  }

  const initialData: Partial<JobFormData> = {
    postingType: job.posting_type,
    title: job.title,
    description: job.description,
    businessType: job.business_type,
    employmentType: job.employment_type,
    region: job.region,
    salaryInfo: job.salary_info ?? '',
    deadline: job.deadline ? job.deadline.split('T')[0] : '',
    image: job.image ?? null,
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Link href={ROUTES.JOBS_DETAIL(params.id)} className="p-2 rounded-lg hover:bg-gray-100 transition-colors">
          <svg className="w-5 h-5 text-gray-500" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
          </svg>
        </Link>
        <h1 className="text-2xl font-bold text-gray-900">공고 수정</h1>
      </div>

      <JobEditForm jobId={params.id} initialData={initialData} />
    </div>
  );
}
