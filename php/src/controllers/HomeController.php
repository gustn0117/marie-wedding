<?php

class HomeController
{
    public static function index(): void
    {
        $jobs = Supabase::table('jobs')
            ->select('*, author:profiles!author_id(id,company_name,contact_name,verification_status)')
            ->is('deleted_at', null)
            ->eq('hidden_by_admin', false)
            ->order('created_at', false)
            ->limit(6)
            ->get();

        $profiles = Supabase::table('profiles')
            ->select('id,company_name,contact_name,business_type,region,profile_image,verification_status,completed_deals_count')
            ->is('deleted_at', null)
            ->eq('is_directory_listed', true)
            ->order('completed_deals_count', false)
            ->limit(4)
            ->get();

        $posts = Supabase::table('posts')
            ->select('id,title,category,view_count,like_count,created_at')
            ->is('deleted_at', null)
            ->order('created_at', false)
            ->limit(4)
            ->get();

        $counts = [
            'verified' => Supabase::table('profiles')->is('deleted_at', null)->eq('verification_status', 'verified')->count(),
            'recentJobs' => Supabase::table('jobs')
                ->is('deleted_at', null)
                ->eq('hidden_by_admin', false)
                ->gte('created_at', date('Y-m-d\TH:i:s', strtotime('-30 days')))
                ->count(),
            'profiles' => Supabase::table('profiles')->is('deleted_at', null)->eq('is_directory_listed', true)->count(),
        ];

        View::render('home', compact('jobs', 'profiles', 'posts', 'counts'));
    }
}
