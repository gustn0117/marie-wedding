<?php
// Front controller — 모든 요청이 여기로 들어옴.

require __DIR__ . '/../src/config.php';
require __DIR__ . '/../src/core/Helpers.php';
require __DIR__ . '/../src/core/Supabase.php';
require __DIR__ . '/../src/core/Auth.php';
require __DIR__ . '/../src/core/Router.php';
require __DIR__ . '/../src/core/View.php';

// 컨트롤러 — autoloading 없이 직접 require
require __DIR__ . '/../src/controllers/HomeController.php';
require __DIR__ . '/../src/controllers/AuthController.php';
require __DIR__ . '/../src/controllers/JobsController.php';

// 라우트 정의
$r = new Router();
$r->get('/', fn() => HomeController::index());
$r->get('/login', fn() => AuthController::loginForm());
$r->post('/login', fn() => AuthController::loginSubmit());
$r->get('/signup', fn() => AuthController::signupForm());
$r->post('/signup', fn() => AuthController::signupSubmit());
$r->get('/logout', fn() => AuthController::logout());

$r->get('/jobs', fn() => JobsController::index());
$r->get('/jobs/{id}', fn($p) => JobsController::detail($p));

// 검색 (단순 jobs 리스트로 리다이렉트)
$r->get('/search', function() {
    $q = $_GET['q'] ?? '';
    View::redirect('/jobs' . ($q ? '?search=' . urlencode($q) : ''));
});

// 정적 페이지 (추후)
$r->get('/contact', fn() => View::render('static/contact', ['pageTitle' => '고객센터 | Marié']));
$r->get('/terms', fn() => View::render('static/terms', ['pageTitle' => '이용약관 | Marié']));
$r->get('/privacy', fn() => View::render('static/privacy', ['pageTitle' => '개인정보처리방침 | Marié']));

$r->dispatch();
