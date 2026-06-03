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
require __DIR__ . '/../src/controllers/DirectoryController.php';
require __DIR__ . '/../src/controllers/SearchController.php';
require __DIR__ . '/../src/controllers/CommunityController.php';

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

$r->get('/directory', fn() => DirectoryController::index());
$r->get('/directory/{id}', fn($p) => DirectoryController::detail($p));
$r->get('/mypage/directory', fn() => DirectoryController::registerForm());
$r->post('/mypage/directory', fn() => DirectoryController::registerSubmit());

$r->get('/search', fn() => SearchController::index());

$r->get('/community', fn() => CommunityController::index());
$r->get('/community/write', fn() => CommunityController::writeForm());
$r->post('/community/write', fn() => CommunityController::writeSubmit());
$r->get('/community/{id}', fn($p) => CommunityController::detail($p));
$r->post('/community/{id}/comment', fn($p) => CommunityController::commentSubmit($p));
$r->post('/community/{id}/like', fn($p) => CommunityController::like($p));

// 정적 페이지 (추후)
$r->get('/contact', fn() => View::render('static/contact', ['pageTitle' => '고객센터 | Marié']));
$r->get('/terms', fn() => View::render('static/terms', ['pageTitle' => '이용약관 | Marié']));
$r->get('/privacy', fn() => View::render('static/privacy', ['pageTitle' => '개인정보처리방침 | Marié']));

$r->dispatch();
