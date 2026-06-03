<?php

class SearchController
{
    public static function index(): void
    {
        $q = trim($_GET['q'] ?? '');

        if (!$q) {
            View::render('search', ['q' => '', 'jobs' => [], 'profiles' => [], 'posts' => [], 'pageTitle' => '검색 | Marié']);
            return;
        }

        $kw = '%' . $q . '%';

        $jobs = Supabase::table('jobs')
            ->select('id,title,region,employment_type,business_type,created_at,deadline,author:profiles!author_id(company_name,contact_name)')
            ->is('deleted_at', null)
            ->eq('hidden_by_admin', false)
            ->ilike('title', $kw)
            ->order('created_at', false)
            ->limit(5)
            ->get();

        $profiles = Supabase::table('profiles')
            ->select('id,company_name,contact_name,business_type,region,profile_image')
            ->is('deleted_at', null)
            ->eq('is_directory_listed', true)
            ->ilike('company_name', $kw)
            ->order('completed_deals_count', false)
            ->limit(5)
            ->get();

        $posts = Supabase::table('posts')
            ->select('id,title,category,view_count,like_count,created_at')
            ->is('deleted_at', null)
            ->ilike('title', $kw)
            ->order('created_at', false)
            ->limit(5)
            ->get();

        View::render('search', [
            'pageTitle' => '"' . $q . '" 검색 결과 | Marié',
            'q' => $q,
            'jobs' => $jobs,
            'profiles' => $profiles,
            'posts' => $posts,
        ]);
    }
}
