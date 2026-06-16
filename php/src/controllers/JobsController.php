<?php

class JobsController
{
    public static function index(): void
    {
        $page = max(1, (int)($_GET['page'] ?? 1));
        $size = 20;
        $offset = ($page - 1) * $size;

        $q = Supabase::table('jobs')
            ->select('*, author:profiles!author_id(id,company_name,contact_name,verification_status)')
            ->is('deleted_at', null)
            ->eq('hidden_by_admin', false)
            ->eq('posting_type', 'hiring')
            ->order('is_promoted', false)
            ->order('created_at', false)
            ->limit($size)
            ->offset($offset);

        if (!empty($_GET['region'])) $q->ilike('region', '%' . $_GET['region'] . '%');
        if (!empty($_GET['businessType'])) $q->ilike('business_type', '%' . $_GET['businessType'] . '%');
        if (!empty($_GET['employmentType'])) $q->eq('employment_type', $_GET['employmentType']);
        if (!empty($_GET['search'])) $q->ilike('title', '%' . $_GET['search'] . '%');

        $jobs = $q->get();

        View::render('jobs/list', [
            'pageTitle' => '채용 정보 | Marié',
            'jobs' => $jobs,
            'page' => $page,
            'filters' => $_GET,
        ]);
    }

    public static function detail(array $params): void
    {
        $id = $params['id'];
        $job = Supabase::table('jobs')
            ->select('*, author:profiles!author_id(*)')
            ->eq('id', $id)
            ->is('deleted_at', null)
            ->first();

        if (!$job) {
            http_response_code(404);
            View::render('errors/404');
            return;
        }

        // 조회수 증가 (간단 dedupe via session)
        if (empty($_SESSION['viewed_jobs'][$id])) {
            Supabase::rpc('increment_job_view_count', [
                'p_job_id' => $id,
                'p_viewer_key' => session_id() . '-' . $id,
            ]);
            $_SESSION['viewed_jobs'][$id] = true;
        }

        // 같은 업체 다른 공고
        $related = Supabase::table('jobs')
            ->select('id,title,region,employment_type,created_at,deadline')
            ->eq('author_id', $job['author_id'])
            ->neq('id', $id)
            ->is('deleted_at', null)
            ->eq('hidden_by_admin', false)
            ->order('created_at', false)
            ->limit(5)
            ->get();

        View::render('jobs/detail', [
            'pageTitle' => $job['title'] . ' | Marié',
            'job' => $job,
            'related' => $related,
        ]);
    }
}
