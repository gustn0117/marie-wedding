<?php
// Supabase Auth wrapper + PHP session 관리
// 로그인 성공 시 access_token을 세션에 저장, 다음 요청부터 그 토큰으로 Supabase REST 호출

class Auth
{
    public static function user(): ?array
    {
        return $_SESSION['user'] ?? null;
    }

    public static function profile(): ?array
    {
        return $_SESSION['profile'] ?? null;
    }

    public static function token(): ?string
    {
        return $_SESSION['access_token'] ?? null;
    }

    public static function check(): bool
    {
        return !empty($_SESSION['user']);
    }

    public static function isAdmin(): bool
    {
        $p = self::profile();
        return $p && (($p['role'] ?? '') === 'admin');
    }

    public static function login(string $email, string $password): array
    {
        $url = SUPABASE_URL . '/auth/v1/token?grant_type=password';
        $resp = self::call($url, 'POST', [
            'email' => $email,
            'password' => $password,
        ], false);

        if (empty($resp['access_token'])) {
            return ['ok' => false, 'error' => $resp['error_description'] ?? $resp['msg'] ?? '로그인에 실패했습니다.'];
        }

        $_SESSION['access_token'] = $resp['access_token'];
        $_SESSION['refresh_token'] = $resp['refresh_token'] ?? null;
        $_SESSION['user'] = $resp['user'] ?? null;

        // profile 동기화
        if (!empty($_SESSION['user']['id'])) {
            $profile = Supabase::table('profiles')
                ->select('id,user_id,contact_name,company_name,account_type,role,region,profile_image,is_directory_listed,verification_status,phone_verified,banned_at')
                ->eq('user_id', $_SESSION['user']['id'])
                ->is('deleted_at', null)
                ->first();
            if ($profile) {
                if (!empty($profile['banned_at'])) {
                    self::logout();
                    return ['ok' => false, 'error' => '제재된 계정입니다. 고객센터에 문의해 주세요.'];
                }
                $_SESSION['profile'] = $profile;
            }
        }

        return ['ok' => true];
    }

    public static function signup(array $data): array
    {
        // 1) Auth signup
        $url = SUPABASE_URL . '/auth/v1/signup';
        $resp = self::call($url, 'POST', [
            'email' => $data['email'],
            'password' => $data['password'],
        ], false);

        if (empty($resp['user']['id'])) {
            return ['ok' => false, 'error' => $resp['msg'] ?? '회원가입에 실패했습니다.'];
        }

        $userId = $resp['user']['id'];
        $token = $resp['access_token'] ?? null;

        // 2) profile insert (service_role 없으므로 user token으로)
        if ($token) {
            $_SESSION['access_token'] = $token;
        }

        $inserted = Supabase::table('profiles')->insert([
            'user_id' => $userId,
            'contact_name' => $data['contact_name'],
            'company_name' => $data['company_name'] ?? null,
            'account_type' => $data['account_type'] ?? 'business',
            'business_type' => $data['business_type'] ?? null,
            'region' => $data['region'],
            'phone' => $data['phone'] ?? null,
        ], $token);

        if (!$inserted) {
            return ['ok' => false, 'error' => '프로필 생성에 실패했습니다. 관리자에게 문의해 주세요.'];
        }

        // 3) 자동 로그인
        return self::login($data['email'], $data['password']);
    }

    public static function logout(): void
    {
        $_SESSION = [];
        if (ini_get('session.use_cookies')) {
            $p = session_get_cookie_params();
            setcookie(session_name(), '', time() - 42000, $p['path'], $p['domain'] ?? '', $p['secure'], $p['httponly']);
        }
        session_destroy();
    }

    private static function call(string $url, string $method, $body = null, bool $withAuth = true)
    {
        $ch = curl_init($url);
        $headers = [
            'apikey: ' . SUPABASE_ANON_KEY,
            'Content-Type: application/json',
        ];
        if ($withAuth && !empty($_SESSION['access_token'])) {
            $headers[] = 'Authorization: Bearer ' . $_SESSION['access_token'];
        }
        curl_setopt_array($ch, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_CUSTOMREQUEST => $method,
            CURLOPT_HTTPHEADER => $headers,
            CURLOPT_USERAGENT => 'curl/8.4.0',
            CURLOPT_TIMEOUT => 30,
            CURLOPT_POSTFIELDS => $body !== null ? json_encode($body, JSON_UNESCAPED_UNICODE) : null,
        ]);
        $resp = curl_exec($ch);
        curl_close($ch);
        return json_decode($resp, true) ?? [];
    }
}
