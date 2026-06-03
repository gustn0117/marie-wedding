<?php
// 공통 유틸 — 지역·업종 라벨, 시간 포맷 등

function business_label(?string $key): string
{
    static $map = [
        'venue' => '예식장',
        'dress' => '드레스샵',
        'studio' => '스튜디오',
        'makeup' => '메이크업',
        'planner' => '웨딩플래너',
        'assistant' => '예식 도우미',
        'mc' => '사회자',
        'designer' => '디자이너',
        'singer' => '축가',
        'other' => '기타',
    ];
    if (!$key) return '';
    $key = trim(explode(',', $key)[0]);
    return $map[$key] ?? $key;
}

function region_label(?string $key): string
{
    static $map = [
        'seoul' => '서울', 'gyeonggi' => '경기', 'incheon' => '인천',
        'busan' => '부산', 'daegu' => '대구', 'daejeon' => '대전',
        'gwangju' => '광주', 'ulsan' => '울산', 'sejong' => '세종',
        'gangwon' => '강원', 'chungbuk' => '충북', 'chungnam' => '충남',
        'jeonbuk' => '전북', 'jeonnam' => '전남',
        'gyeongbuk' => '경북', 'gyeongnam' => '경남', 'jeju' => '제주',
    ];
    if (!$key) return '';
    $key = trim(explode(',', $key)[0]);
    return $map[$key] ?? $key;
}

function employment_label(?string $key): string
{
    static $map = ['full_time' => '정규직', 'contract' => '계약직', 'part_time' => '단기알바'];
    return $map[$key] ?? ($key ?? '');
}

function relative_time(?string $iso): string
{
    if (!$iso) return '';
    $ts = strtotime($iso);
    if (!$ts) return '';
    $diff = time() - $ts;
    if ($diff < 60) return '방금 전';
    if ($diff < 3600) return floor($diff / 60) . '분 전';
    if ($diff < 86400) return floor($diff / 3600) . '시간 전';
    if ($diff < 2592000) return floor($diff / 86400) . '일 전';
    if ($diff < 31104000) return floor($diff / 2592000) . '개월 전';
    return floor($diff / 31104000) . '년 전';
}

function format_date(?string $iso): string
{
    if (!$iso) return '';
    $ts = strtotime($iso);
    if (!$ts) return '';
    return date('Y.m.d', $ts);
}

function csrf_token(): string
{
    if (empty($_SESSION['csrf'])) {
        $_SESSION['csrf'] = bin2hex(random_bytes(16));
    }
    return $_SESSION['csrf'];
}

function check_csrf(?string $token): bool
{
    return !empty($_SESSION['csrf']) && hash_equals($_SESSION['csrf'], (string)$token);
}

function old(string $key, $default = ''): string
{
    $val = $_SESSION['_old'][$key] ?? $default;
    return is_string($val) ? $val : '';
}

function flash(?string $key = null, $value = null)
{
    if ($value !== null && $key !== null) {
        $_SESSION['_flash'][$key] = $value;
        return null;
    }
    if ($key !== null) {
        $v = $_SESSION['_flash'][$key] ?? null;
        unset($_SESSION['_flash'][$key]);
        return $v;
    }
    return null;
}
