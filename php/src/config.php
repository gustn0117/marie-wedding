<?php
// Marié — Supabase 연동 설정
// 카페24 호스팅에서는 환경변수 직접 설정이 어려우니 이 파일에서 관리
// 운영 배포 시 이 파일을 public 외부에 두고 require로 포함

// Supabase 자체 호스팅
define('SUPABASE_URL', 'https://api.hsweb.pics');
define('SUPABASE_ANON_KEY', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoiYW5vbiIsImlzcyI6InN1cGFiYXNlIiwiaWF0IjoxNjQxNzY5MjAwLCJleHAiOjE3OTk1MzU2MDB9.pei5Gx1wqEkbcDs1CiHFuTWNuVRlcrG5dPmYdrAqDdY');
define('SUPABASE_SCHEMA', 'marie_wedding');
define('APP_NAME', 'Marié');
define('APP_URL', 'https://marie-wedding.hsweb.pics');

// 세션
if (session_status() === PHP_SESSION_NONE) {
    session_name('marie_session');
    session_set_cookie_params([
        'lifetime' => 60 * 60 * 24 * 7,
        'path' => '/',
        'secure' => isset($_SERVER['HTTPS']),
        'httponly' => true,
        'samesite' => 'Lax',
    ]);
    session_start();
}

// 기본 시간대
date_default_timezone_set('Asia/Seoul');

// 에러 표시 (운영에서는 0으로)
ini_set('display_errors', '0');
error_reporting(E_ALL);
