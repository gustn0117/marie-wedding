<?php

class AuthController
{
    public static function loginForm(): void
    {
        if (Auth::check()) View::redirect('/');
        View::render('auth/login', ['pageTitle' => '로그인 | Marié']);
    }

    public static function loginSubmit(): void
    {
        if (!check_csrf($_POST['_csrf'] ?? null)) {
            flash('error', '잘못된 요청입니다. 다시 시도해 주세요.');
            View::redirect('/login');
        }
        $email = trim($_POST['email'] ?? '');
        $password = $_POST['password'] ?? '';
        if (!$email || !$password) {
            flash('error', '이메일과 비밀번호를 입력해 주세요.');
            View::redirect('/login');
        }
        $result = Auth::login($email, $password);
        if (!$result['ok']) {
            flash('error', $result['error']);
            View::redirect('/login');
        }
        flash('success', '로그인했습니다.');
        View::redirect('/');
    }

    public static function signupForm(): void
    {
        if (Auth::check()) View::redirect('/');
        View::render('auth/signup', ['pageTitle' => '회원가입 | Marié']);
    }

    public static function signupSubmit(): void
    {
        if (!check_csrf($_POST['_csrf'] ?? null)) {
            flash('error', '잘못된 요청입니다.');
            View::redirect('/signup');
        }
        $email = trim($_POST['email'] ?? '');
        $password = $_POST['password'] ?? '';
        $contactName = trim($_POST['contact_name'] ?? '');
        $companyName = trim($_POST['company_name'] ?? '');
        $accountType = $_POST['account_type'] ?? 'business';
        $businessType = $_POST['business_type'] ?? null;
        $region = $_POST['region'] ?? '';
        $phone = trim($_POST['phone'] ?? '');

        if (!$email || !$password || !$contactName || !$region) {
            flash('error', '필수 정보를 모두 입력해 주세요.');
            View::redirect('/signup');
        }
        if (strlen($password) < 8) {
            flash('error', '비밀번호는 8자 이상이어야 합니다.');
            View::redirect('/signup');
        }

        $result = Auth::signup([
            'email' => $email,
            'password' => $password,
            'contact_name' => $contactName,
            'company_name' => $companyName ?: null,
            'account_type' => $accountType,
            'business_type' => $businessType,
            'region' => $region,
            'phone' => $phone ?: null,
        ]);

        if (!$result['ok']) {
            flash('error', $result['error']);
            View::redirect('/signup');
        }
        flash('success', '환영합니다! 회원가입이 완료되었습니다.');
        View::redirect('/');
    }

    public static function logout(): void
    {
        Auth::logout();
        View::redirect('/');
    }
}
