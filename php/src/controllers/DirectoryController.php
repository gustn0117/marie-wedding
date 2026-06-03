<?php

class DirectoryController
{
    public static function index(): void
    {
        $page = max(1, (int)($_GET['page'] ?? 1));
        $size = 20;
        $offset = ($page - 1) * $size;

        $q = Supabase::table('profiles')
            ->select('id,company_name,contact_name,business_type,region,profile_image,bio,verification_status,phone_verified,completed_deals_count,response_rate,premium_tier')
            ->is('deleted_at', null)
            ->eq('is_directory_listed', true)
            ->order('premium_tier', false)
            ->order('completed_deals_count', false)
            ->order('verified_at', false)
            ->limit($size)
            ->offset($offset);

        if (!empty($_GET['businessType'])) $q->ilike('business_type', '%' . $_GET['businessType'] . '%');
        if (!empty($_GET['region'])) $q->ilike('region', '%' . $_GET['region'] . '%');
        if (!empty($_GET['search'])) {
            // PostgREST or 필터
            $kw = $_GET['search'];
            $q->ilike('company_name', '%' . $kw . '%');
        }

        $profiles = $q->get();

        View::render('directory/list', [
            'pageTitle' => '업체 디렉토리 | Marié',
            'profiles' => $profiles,
            'filters' => $_GET,
            'page' => $page,
        ]);
    }

    public static function detail(array $params): void
    {
        $id = $params['id'];
        $profile = Supabase::table('profiles')
            ->select('*')
            ->eq('id', $id)
            ->is('deleted_at', null)
            ->first();

        if (!$profile) {
            http_response_code(404);
            View::render('errors/404');
            return;
        }

        // 이 업체의 공고
        $jobs = Supabase::table('jobs')
            ->select('id,title,region,employment_type,created_at,deadline,status')
            ->eq('author_id', $id)
            ->is('deleted_at', null)
            ->eq('hidden_by_admin', false)
            ->order('created_at', false)
            ->limit(10)
            ->get();

        // 포트폴리오
        $portfolios = Supabase::table('portfolios')
            ->select('id,title,event_date,role,venue_name,cover_image,images,is_featured')
            ->eq('profile_id', $id)
            ->is('deleted_at', null)
            ->order('is_featured', false)
            ->order('created_at', false)
            ->limit(8)
            ->get();

        View::render('directory/detail', [
            'pageTitle' => ($profile['company_name'] ?? $profile['contact_name']) . ' | Marié',
            'profile' => $profile,
            'jobs' => $jobs,
            'portfolios' => $portfolios,
        ]);
    }

    public static function registerForm(): void
    {
        if (!Auth::check()) View::redirect('/login');
        $me = Auth::profile();
        $full = Supabase::table('profiles')
            ->select('*')
            ->eq('id', $me['id'])
            ->first();
        View::render('directory/register', [
            'pageTitle' => '업체 등록 | Marié',
            'profile' => $full ?: $me,
        ]);
    }

    public static function registerSubmit(): void
    {
        if (!Auth::check()) View::redirect('/login');
        if (!check_csrf($_POST['_csrf'] ?? null)) {
            flash('error', '잘못된 요청입니다.');
            View::redirect('/mypage/directory');
        }
        $me = Auth::profile();
        $update = [
            'company_name' => trim($_POST['company_name'] ?? '') ?: null,
            'business_type' => $_POST['business_type'] ?? null,
            'region' => $_POST['region'] ?? '',
            'bio' => trim($_POST['bio'] ?? '') ?: null,
            'website' => trim($_POST['website'] ?? '') ?: null,
            'address' => trim($_POST['address'] ?? '') ?: null,
            'company_size' => trim($_POST['company_size'] ?? '') ?: null,
            'established_year' => trim($_POST['established_year'] ?? '') ?: null,
            'is_directory_listed' => isset($_POST['is_directory_listed']),
        ];
        $resp = Supabase::table('profiles')->eq('id', $me['id'])->update($update);
        if (!$resp) {
            flash('error', '저장에 실패했습니다.');
        } else {
            flash('success', '디렉토리 정보를 저장했습니다.');
            // 세션의 profile 캐시도 업데이트
            $_SESSION['profile'] = array_merge($_SESSION['profile'] ?? [], $update);
        }
        View::redirect('/mypage/directory');
    }
}
