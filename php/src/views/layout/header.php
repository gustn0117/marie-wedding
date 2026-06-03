<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title><?= View::e($pageTitle ?? 'Marié — 웨딩 업계 B2B 네트워크') ?></title>
<meta name="description" content="<?= View::e($pageDesc ?? '웨딩 업계 종사자를 위한 채용·디렉토리·커뮤니티 플랫폼') ?>">
<link rel="preconnect" href="https://cdn.jsdelivr.net">
<link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/static/pretendard.min.css">
<script src="https://cdn.tailwindcss.com"></script>
<script>
  tailwind.config = {
    theme: {
      extend: {
        colors: {
          primary: { DEFAULT: '#3617ce', dark: '#2410a0', 50: '#f3f0fd', 100: '#e6dffb', 600: '#3617ce', 700: '#2410a0' },
        },
        fontFamily: { sans: ['Pretendard', 'sans-serif'] },
        borderRadius: { DEFAULT: '10px', xl: '16px', '2xl': '20px' },
      },
    },
  };
</script>
<style>
  body { font-family: 'Pretendard', -apple-system, sans-serif; }
  .btn-primary { background: #3617ce; color: white; padding: 12px 20px; border-radius: 10px; font-weight: 600; font-size: 14px; transition: all .15s; display: inline-flex; align-items: center; gap: 8px; }
  .btn-primary:hover { background: #2410a0; }
  .btn-outline { background: white; color: #18181b; padding: 12px 20px; border-radius: 10px; border: 1px solid #d4d4d8; font-weight: 600; font-size: 14px; transition: all .15s; display: inline-flex; align-items: center; gap: 8px; }
  .btn-outline:hover { border-color: #18181b; }
  .card { background: white; border: 1px solid #e4e4e7; border-radius: 14px; padding: 20px; transition: all .2s; }
  .card:hover { box-shadow: 0 2px 8px rgba(24,24,27,.06); transform: translateY(-2px); }
  .input { width: 100%; padding: 12px 16px; border: 1px solid #d4d4d8; border-radius: 10px; font-size: 15px; transition: all .15s; outline: none; }
  .input:focus { border-color: #3617ce; box-shadow: 0 0 0 4px rgba(54,23,206,.08); }
</style>
</head>
<body class="bg-white text-gray-900">

<header class="sticky top-0 z-50 bg-white border-b border-gray-200">
  <div class="hidden md:block bg-gray-50 border-b border-gray-200">
    <div class="max-w-[1200px] mx-auto px-4 h-9 flex items-center justify-between text-xs text-gray-600">
      <div class="flex items-center gap-3">
        <span class="rounded border border-gray-300 bg-white px-2 py-0.5 font-bold text-gray-800">Marié 운영 네트워크</span>
        <a href="/jobs/new" class="hover:text-primary">공고 등록</a>
        <a href="/contact" class="hover:text-primary">고객센터</a>
      </div>
      <div class="flex items-center gap-3">
        <?php if (Auth::check()): ?>
          <a href="/mypage" class="hover:text-primary">마이페이지</a>
          <a href="/logout" class="hover:text-primary">로그아웃</a>
        <?php else: ?>
          <a href="/login" class="hover:text-primary">로그인</a>
          <span class="w-px h-3 bg-gray-300"></span>
          <a href="/signup" class="hover:text-primary">회원가입</a>
        <?php endif; ?>
      </div>
    </div>
  </div>

  <div class="max-w-[1200px] mx-auto px-4 h-16 flex items-center gap-6">
    <a href="/" class="text-xl font-bold tracking-tight text-gray-900">Marié</a>
    <nav class="hidden md:flex items-center gap-1 text-sm font-semibold">
      <a href="/jobs?type=hiring" class="px-3 py-2 rounded hover:bg-gray-50 hover:text-primary">채용정보</a>
      <a href="/jobs?type=matching" class="px-3 py-2 rounded hover:bg-gray-50 hover:text-primary">파트너 섭외</a>
      <a href="/directory" class="px-3 py-2 rounded hover:bg-gray-50 hover:text-primary">업체 디렉토리</a>
      <a href="/community" class="px-3 py-2 rounded hover:bg-gray-50 hover:text-primary">커뮤니티</a>
    </nav>
    <div class="ml-auto flex items-center gap-2">
      <a href="/jobs/new" class="hidden sm:inline-flex btn-outline text-xs px-3 py-2">공고 등록</a>
      <?php if (Auth::check()): ?>
        <a href="/mypage" class="btn-primary text-xs px-3 py-2">마이페이지</a>
      <?php else: ?>
        <a href="/login" class="btn-primary text-xs px-3 py-2">로그인</a>
      <?php endif; ?>
    </div>
  </div>
</header>

<?php if ($flashSuccess = flash('success')): ?>
  <div class="max-w-[1200px] mx-auto px-4 mt-3"><div class="rounded-lg border border-green-200 bg-green-50 text-green-800 text-sm px-4 py-3"><?= View::e($flashSuccess) ?></div></div>
<?php endif; ?>
<?php if ($flashError = flash('error')): ?>
  <div class="max-w-[1200px] mx-auto px-4 mt-3"><div class="rounded-lg border border-red-200 bg-red-50 text-red-800 text-sm px-4 py-3"><?= View::e($flashError) ?></div></div>
<?php endif; ?>

<main>
