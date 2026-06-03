<?php

class MypageController
{
    private static function guard(): array
    {
        if (!Auth::check()) {
            View::redirect('/login');
        }
        return Auth::profile();
    }

    public static function index(): void
    {
        $me = self::guard();

        $full = Supabase::table('profiles')->select('*')->eq('id', $me['id'])->first() ?: $me;

        $myJobsCount = Supabase::table('jobs')->is('deleted_at', null)->eq('author_id', $me['id'])->count();
        $myPostsCount = Supabase::table('posts')->is('deleted_at', null)->eq('author_id', $me['id'])->count();
        $myApplicationsCount = Supabase::table('applications')->is('deleted_at', null)->eq('applicant_id', $me['id'])->count();

        // 최근 활동
        $recentJobs = Supabase::table('jobs')
            ->select('id,title,view_count,created_at,status')
            ->eq('author_id', $me['id'])
            ->is('deleted_at', null)
            ->order('created_at', false)
            ->limit(3)
            ->get();

        $recentPosts = Supabase::table('posts')
            ->select('id,title,view_count,like_count,comment_count,created_at')
            ->eq('author_id', $me['id'])
            ->is('deleted_at', null)
            ->order('created_at', false)
            ->limit(3)
            ->get();

        View::render('mypage/index', [
            'pageTitle' => '마이페이지 | Marié',
            'profile' => $full,
            'counts' => [
                'jobs' => $myJobsCount,
                'posts' => $myPostsCount,
                'applications' => $myApplicationsCount,
            ],
            'recentJobs' => $recentJobs,
            'recentPosts' => $recentPosts,
        ]);
    }

    public static function profileForm(): void
    {
        $me = self::guard();
        $full = Supabase::table('profiles')->select('*')->eq('id', $me['id'])->first() ?: $me;
        View::render('mypage/profile', [
            'pageTitle' => '프로필 수정 | Marié',
            'profile' => $full,
        ]);
    }

    public static function profileSubmit(): void
    {
        $me = self::guard();
        if (!check_csrf($_POST['_csrf'] ?? null)) {
            flash('error', '잘못된 요청입니다.');
            View::redirect('/mypage/profile');
        }

        $update = [
            'contact_name' => trim($_POST['contact_name'] ?? '') ?: null,
            'company_name' => trim($_POST['company_name'] ?? '') ?: null,
            'business_type' => $_POST['business_type'] ?? null,
            'region' => $_POST['region'] ?? '',
            'phone' => trim($_POST['phone'] ?? '') ?: null,
            'bio' => trim($_POST['bio'] ?? '') ?: null,
        ];

        $resp = Supabase::table('profiles')->eq('id', $me['id'])->update($update);
        if ($resp) {
            $_SESSION['profile'] = array_merge($_SESSION['profile'] ?? [], $update);
            flash('success', '프로필을 저장했습니다.');
        } else {
            flash('error', '저장에 실패했습니다.');
        }
        View::redirect('/mypage/profile');
    }

    public static function jobs(): void
    {
        $me = self::guard();
        $jobs = Supabase::table('jobs')
            ->select('*')
            ->eq('author_id', $me['id'])
            ->is('deleted_at', null)
            ->order('created_at', false)
            ->limit(50)
            ->get();
        View::render('mypage/jobs', [
            'pageTitle' => '내 공고 | Marié',
            'jobs' => $jobs,
        ]);
    }

    public static function posts(): void
    {
        $me = self::guard();
        $posts = Supabase::table('posts')
            ->select('id,title,category,view_count,like_count,comment_count,created_at')
            ->eq('author_id', $me['id'])
            ->is('deleted_at', null)
            ->order('created_at', false)
            ->limit(50)
            ->get();
        View::render('mypage/posts', [
            'pageTitle' => '내 글 | Marié',
            'posts' => $posts,
        ]);
    }

    public static function applications(): void
    {
        $me = self::guard();
        $apps = Supabase::table('applications')
            ->select('*, job:jobs(id,title,region,employment_type,deleted_at)')
            ->eq('applicant_id', $me['id'])
            ->is('deleted_at', null)
            ->order('created_at', false)
            ->limit(50)
            ->get();
        View::render('mypage/applications', [
            'pageTitle' => '내 신청 | Marié',
            'applications' => $apps,
        ]);
    }
}
