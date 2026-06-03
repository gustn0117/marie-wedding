<?php

class CommunityController
{
    public static function index(): void
    {
        $page = max(1, (int)($_GET['page'] ?? 1));
        $size = 20;
        $offset = ($page - 1) * $size;

        $q = Supabase::table('posts')
            ->select('id,title,content,category,view_count,like_count,comment_count,created_at,author:profiles!author_id(id,company_name,contact_name,business_type)')
            ->is('deleted_at', null);

        if (!empty($_GET['category'])) $q->eq('category', $_GET['category']);
        if (!empty($_GET['search'])) $q->ilike('title', '%' . $_GET['search'] . '%');

        $sort = $_GET['sort'] ?? 'recent';
        if ($sort === 'popular') $q->order('like_count', false);
        elseif ($sort === 'comments') $q->order('comment_count', false);
        else $q->order('created_at', false);

        $posts = $q->limit($size)->offset($offset)->get();

        $categories = [
            '' => '전체',
            'qna' => '질문',
            'tip' => '노하우',
            'review' => '후기',
            'discussion' => '토론',
            'event' => '이벤트',
            'free' => '자유',
        ];

        View::render('community/list', [
            'pageTitle' => '커뮤니티 | Marié',
            'posts' => $posts,
            'filters' => $_GET,
            'page' => $page,
            'categories' => $categories,
        ]);
    }

    public static function detail(array $params): void
    {
        $id = $params['id'];
        $post = Supabase::table('posts')
            ->select('*, author:profiles!author_id(id,company_name,contact_name,business_type,profile_image,verification_status)')
            ->eq('id', $id)
            ->is('deleted_at', null)
            ->first();

        if (!$post) {
            http_response_code(404);
            View::render('errors/404');
            return;
        }

        // 조회수 증가 (세션 dedupe)
        if (empty($_SESSION['viewed_posts'][$id])) {
            Supabase::table('posts')
                ->eq('id', $id)
                ->update(['view_count' => ($post['view_count'] ?? 0) + 1]);
            $_SESSION['viewed_posts'][$id] = true;
            $post['view_count'] = ($post['view_count'] ?? 0) + 1;
        }

        // 댓글
        $comments = Supabase::table('comments')
            ->select('*, author:profiles!author_id(id,company_name,contact_name,profile_image)')
            ->eq('post_id', $id)
            ->is('deleted_at', null)
            ->order('created_at', true)
            ->limit(200)
            ->get();

        View::render('community/detail', [
            'pageTitle' => $post['title'] . ' | 커뮤니티 | Marié',
            'post' => $post,
            'comments' => $comments,
        ]);
    }

    public static function writeForm(): void
    {
        if (!Auth::check()) View::redirect('/login');
        View::render('community/write', [
            'pageTitle' => '글쓰기 | Marié',
            'categories' => ['qna' => '질문', 'tip' => '노하우', 'review' => '후기', 'discussion' => '토론', 'free' => '자유'],
        ]);
    }

    public static function writeSubmit(): void
    {
        if (!Auth::check()) View::redirect('/login');
        if (!check_csrf($_POST['_csrf'] ?? null)) {
            flash('error', '잘못된 요청입니다.');
            View::redirect('/community/write');
        }

        $title = trim($_POST['title'] ?? '');
        $content = trim($_POST['content'] ?? '');
        $category = $_POST['category'] ?? 'free';

        if (!$title || !$content) {
            flash('error', '제목과 본문을 입력해 주세요.');
            View::redirect('/community/write');
        }

        $me = Auth::profile();
        $result = Supabase::table('posts')->insert([
            'author_id' => $me['id'],
            'title' => mb_substr($title, 0, 200),
            'content' => $content,
            'category' => $category,
        ], Auth::token());

        if (!$result || empty($result[0]['id'])) {
            flash('error', '글 등록에 실패했습니다.');
            View::redirect('/community/write');
        }

        flash('success', '글이 등록되었습니다.');
        View::redirect('/community/' . $result[0]['id']);
    }

    public static function commentSubmit(array $params): void
    {
        if (!Auth::check()) View::redirect('/login');
        if (!check_csrf($_POST['_csrf'] ?? null)) {
            flash('error', '잘못된 요청입니다.');
            View::redirect('/community/' . $params['id']);
        }
        $postId = $params['id'];
        $content = trim($_POST['content'] ?? '');
        if (!$content) {
            flash('error', '댓글 내용을 입력해 주세요.');
            View::redirect('/community/' . $postId);
        }

        $me = Auth::profile();
        $result = Supabase::table('comments')->insert([
            'post_id' => $postId,
            'author_id' => $me['id'],
            'content' => mb_substr($content, 0, 2000),
            'parent_id' => !empty($_POST['parent_id']) ? $_POST['parent_id'] : null,
        ], Auth::token());

        if (!$result) {
            flash('error', '댓글 등록에 실패했습니다.');
        } else {
            // post comment_count++
            $post = Supabase::table('posts')->select('comment_count')->eq('id', $postId)->first();
            Supabase::table('posts')->eq('id', $postId)->update(['comment_count' => ($post['comment_count'] ?? 0) + 1]);
            flash('success', '댓글을 등록했습니다.');
        }

        View::redirect('/community/' . $postId . '#comments');
    }

    public static function like(array $params): void
    {
        if (!Auth::check()) {
            header('Content-Type: application/json');
            echo json_encode(['ok' => false, 'error' => '로그인이 필요합니다.']);
            return;
        }
        if (!check_csrf($_POST['_csrf'] ?? null)) {
            header('Content-Type: application/json');
            echo json_encode(['ok' => false, 'error' => '잘못된 요청입니다.']);
            return;
        }
        $postId = $params['id'];
        $me = Auth::profile();

        // 토글: 이미 좋아요 있으면 해제, 없으면 추가
        $existing = Supabase::table('post_likes')
            ->select('id')
            ->eq('post_id', $postId)
            ->eq('user_id', $me['id'])
            ->first();

        if ($existing) {
            Supabase::table('post_likes')->eq('id', $existing['id'])->update(['deleted_at' => date('c')]);
            $delta = -1;
            $liked = false;
        } else {
            Supabase::table('post_likes')->insert([
                'post_id' => $postId,
                'user_id' => $me['id'],
            ], Auth::token());
            $delta = 1;
            $liked = true;
        }

        $post = Supabase::table('posts')->select('like_count')->eq('id', $postId)->first();
        $newCount = max(0, ($post['like_count'] ?? 0) + $delta);
        Supabase::table('posts')->eq('id', $postId)->update(['like_count' => $newCount]);

        header('Content-Type: application/json');
        echo json_encode(['ok' => true, 'liked' => $liked, 'count' => $newCount]);
    }
}
