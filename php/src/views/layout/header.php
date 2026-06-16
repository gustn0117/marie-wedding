<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title><?= View::e($pageTitle ?? 'Marié — 웨딩 업계 구인구직') ?></title>
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
          ink: { DEFAULT: '#1a1a1a' },
        },
        fontFamily: { sans: ['Pretendard', 'sans-serif'] },
      },
    },
  };
</script>
<style>
  body { font-family: 'Pretendard', -apple-system, sans-serif; color: #1a1a1a; background: #fff; }

  .btn-primary { background: #3617ce; color: white; padding: 11px 22px; border-radius: 8px; font-weight: 700; font-size: 14px; transition: all .15s; display: inline-flex; align-items: center; justify-content: center; gap: 6px; }
  .btn-primary:hover { background: #2410a0; }
  .btn-outline { background: white; color: #1a1a1a; padding: 11px 22px; border-radius: 8px; border: 1px solid #d4d4d8; font-weight: 700; font-size: 14px; transition: all .15s; display: inline-flex; align-items: center; justify-content: center; gap: 6px; }
  .btn-outline:hover { border-color: #1a1a1a; }
  .input { width: 100%; padding: 12px 16px; border: 1px solid #d4d4d8; border-radius: 8px; font-size: 15px; outline: none; transition: all .15s; }
  .input:focus { border-color: #3617ce; box-shadow: 0 0 0 3px rgba(54,23,206,.08); }

  /* Kmong 풍 컴포넌트 */
  .header-search {
    display: flex; align-items: center; height: 44px; padding: 0 18px;
    border-radius: 999px; background: #f4f4f5;
    transition: all .15s; gap: 10px; color: #71717a; font-size: 14px;
  }
  .header-search:hover { background: #e9e9eb; }
  .header-search:focus-within { background: #fff; box-shadow: inset 0 0 0 2px #1a1a1a; }

  .icon-btn { width: 36px; height: 36px; display: inline-flex; align-items: center; justify-content: center; border-radius: 50%; color: #52525b; transition: all .15s; }
  .icon-btn:hover { background: #f4f4f5; color: #1a1a1a; }

  .cat-nav-link { padding: 14px 14px; font-size: 15px; font-weight: 700; color: #3f3f46; white-space: nowrap; border-bottom: 2px solid transparent; transition: all .15s; }
  .cat-nav-link:hover { color: #1a1a1a; }
  .cat-nav-link.active { color: #1a1a1a; border-bottom-color: #1a1a1a; }

  .hero-chip { padding: 8px 14px; border-radius: 999px; font-size: 13px; font-weight: 600; background: #fff; color: #3f3f46; border: 1px solid #e4e4e7; transition: all .15s; }
  .hero-chip:hover { border-color: #1a1a1a; color: #1a1a1a; }
  .hero-chip-primary { background: #f3f0fd; color: #3617ce; border-color: #d9d0fa; }
  .hero-chip-primary:hover { background: #e6dffb; border-color: #3617ce; color: #2410a0; }

  .cat-tile { display: flex; flex-direction: column; align-items: center; gap: 6px; padding: 12px 4px; position: relative; transition: all .15s; }
  .cat-tile:hover .cat-tile-icon { transform: translateY(-3px); }
  .cat-tile-icon {
    width: 64px; height: 64px; border-radius: 16px;
    display: flex; align-items: center; justify-content: center;
    font-size: 32px; transition: transform .15s;
  }
  .cat-tile-label { font-size: 13px; font-weight: 600; color: #1a1a1a; }
  .cat-tile-badge {
    position: absolute; top: -2px; left: 50%; transform: translateX(-50%);
    background: #fff5f5; color: #e11d48;
    border: 1px solid #fecaca; border-radius: 5px;
    font-size: 10px; font-weight: 700; padding: 1px 5px;
    line-height: 1.4;
  }
  .cat-tile-badge.best { background: #f3f0fd; color: #3617ce; border-color: #d9d0fa; }

  /* 서비스 카드 (크몽 풍) */
  .svc-card { display: block; }
  .svc-card-thumb {
    position: relative; aspect-ratio: 4/3;
    border-radius: 12px; overflow: hidden;
    background: #f4f4f5;
  }
  .svc-card-thumb-img { width: 100%; height: 100%; object-fit: cover; }
  .svc-card-badge {
    position: absolute; top: 8px; left: 8px;
    background: rgba(0,0,0,0.7); color: #fff;
    border-radius: 4px; font-size: 11px; font-weight: 700;
    padding: 3px 7px; backdrop-filter: blur(4px);
  }
  .svc-card-badge.prime { background: #1a1a1a; }
  .svc-card-badge.promoted { background: #3617ce; }
  .svc-card-title {
    margin-top: 10px; font-size: 14px; font-weight: 500;
    color: #1a1a1a; line-height: 1.45;
    display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical;
    overflow: hidden;
    min-height: 40px;
  }
  .svc-card-rating { display: inline-flex; align-items: center; gap: 4px; font-size: 13px; }
  .svc-card-rating .star { color: #fbbf24; }
  .svc-card-rating .count { color: #71717a; font-weight: 500; }
  .svc-card-price { margin-top: 4px; font-size: 16px; font-weight: 700; color: #1a1a1a; }
  .svc-card-seller { margin-top: 8px; padding-top: 8px; border-top: 1px solid #f4f4f5; font-size: 12px; color: #71717a; display: flex; align-items: center; gap: 6px; }
  .svc-card-seller .m-badge { display: inline-flex; align-items: center; justify-content: center; width: 14px; height: 14px; border-radius: 3px; background: #3617ce; color: #fff; font-size: 9px; font-weight: 800; }

  /* 가로 스크롤 캐러셀 */
  .h-scroll {
    display: flex; gap: 16px;
    overflow-x: auto; scroll-snap-type: x mandatory;
    scrollbar-width: none; -ms-overflow-style: none;
    padding-bottom: 4px;
  }
  .h-scroll::-webkit-scrollbar { display: none; }
  .h-scroll > * { flex: 0 0 220px; scroll-snap-align: start; }

  /* 프로모 배너 */
  .promo-card {
    position: relative; overflow: hidden;
    border-radius: 20px; padding: 28px;
    background: linear-gradient(135deg, #fce7f3 0%, #fbcfe8 50%, #f5d0fe 100%);
    min-height: 280px;
    display: flex; flex-direction: column; justify-content: flex-end;
  }
  .promo-card .promo-illust {
    position: absolute; top: 50%; right: 24px; transform: translateY(-50%);
    font-size: 96px; opacity: .85;
  }
  .promo-card h3 { font-size: 22px; font-weight: 800; color: #1a1a1a; line-height: 1.3; }
  .promo-card p { margin-top: 6px; font-size: 14px; color: #3f3f46; }
  .promo-page { position: absolute; bottom: 18px; right: 22px; display: inline-flex; align-items: center; gap: 6px; padding: 4px 10px; background: rgba(255,255,255,.7); border-radius: 999px; font-size: 12px; font-weight: 600; color: #1a1a1a; }

  .line-clamp-2 { display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
  .line-clamp-1 { display: -webkit-box; -webkit-line-clamp: 1; -webkit-box-orient: vertical; overflow: hidden; }
</style>
</head>
<body>

<header class="sticky top-0 z-50 bg-white border-b border-gray-100">
  <!-- 1단: 로고 + 검색바 + 우측 메뉴 -->
  <div class="max-w-[1280px] mx-auto px-5 h-[68px] flex items-center gap-6">
    <a href="/" class="text-2xl font-extrabold tracking-tight text-ink shrink-0">Marié</a>

    <div class="hidden md:flex items-center gap-1.5 shrink-0">
      <span class="text-gray-300">|</span>
      <a href="/jobs/new" class="text-sm font-semibold text-gray-700 hover:text-ink px-2">Marié Biz</a>
      <label class="inline-flex items-center cursor-pointer">
        <input type="checkbox" class="sr-only peer">
        <div class="w-10 h-6 bg-gray-200 rounded-full peer peer-checked:bg-primary transition-colors relative">
          <div class="absolute left-0.5 top-0.5 w-5 h-5 bg-white rounded-full transition-all peer-checked:translate-x-4"></div>
        </div>
      </label>
    </div>

    <form action="/search" method="GET" class="flex-1 max-w-[480px] hidden md:block">
      <label class="header-search cursor-text">
        <svg class="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke-width="2.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z"/></svg>
        <input type="text" name="q" placeholder="어떤 전문가가 필요하세요?" class="bg-transparent border-none outline-none flex-1 text-[14px] placeholder:text-gray-500 text-ink">
      </label>
    </form>

    <nav class="ml-auto flex items-center gap-1 shrink-0">
      <a href="/jobs/new" class="hidden lg:inline-flex items-center gap-1.5 text-sm font-semibold text-gray-700 hover:text-ink px-3 py-2">
        엔터프라이즈 <span class="text-[10px] font-bold text-primary bg-primary-50 px-1.5 py-0.5 rounded">기업용</span>
      </a>
      <a href="/mypage/applications" class="hidden lg:inline-flex text-sm font-semibold text-gray-700 hover:text-ink px-3 py-2">주문 관리</a>
      <a href="/community" class="icon-btn" title="커뮤니티">
        <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke-width="1.8" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M2.25 12.76c0 1.6 1.123 2.994 2.707 3.227 1.087.16 2.185.283 3.293.369V21l4.184-4.183a1.14 1.14 0 01.778-.332 48.294 48.294 0 005.83-.498c1.585-.233 2.708-1.626 2.708-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0012 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018z"/></svg>
      </a>
      <button type="button" class="icon-btn" title="알림">
        <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke-width="1.8" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0"/></svg>
      </button>
      <a href="/directory" class="icon-btn" title="저장한 업체">
        <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke-width="1.8" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z"/></svg>
      </a>
      <?php if (Auth::check()): $me = Auth::profile(); $name = $me['company_name'] ?: $me['contact_name']; ?>
        <a href="/mypage" class="flex items-center gap-1 ml-1">
          <div class="w-9 h-9 rounded-full bg-gradient-to-br from-primary-50 to-primary-100 border border-gray-200 flex items-center justify-center text-sm font-bold text-primary">
            <?= View::e(mb_substr($name, 0, 1)) ?>
          </div>
          <svg class="w-3 h-3 text-gray-400" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.06l3.71-3.83a.75.75 0 111.08 1.04l-4.25 4.39a.75.75 0 01-1.08 0L5.21 8.27a.75.75 0 01.02-1.06z" clip-rule="evenodd"/></svg>
        </a>
      <?php else: ?>
        <a href="/login" class="ml-1 px-4 h-9 inline-flex items-center text-sm font-bold border border-gray-300 hover:border-ink rounded-full">로그인</a>
      <?php endif; ?>
    </nav>
  </div>

  <!-- 2단: 카테고리 nav (홈/리스트에서만 노출) -->
  <?php if (!empty($showCatNav)): ?>
  <div class="border-t border-gray-100">
    <div class="max-w-[1280px] mx-auto px-5 flex items-center gap-1 overflow-x-auto">
      <a href="/" class="cat-nav-link flex items-center gap-1.5 <?= ($activeNav ?? '') === 'home' ? 'active' : '' ?>">
        <span class="inline-flex items-center justify-center w-5 h-5 rounded bg-green-500 text-white text-[10px]">🌿</span>
        업종별
        <svg class="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.06l3.71-3.83a.75.75 0 111.08 1.04l-4.25 4.39a.75.75 0 01-1.08 0L5.21 8.27a.75.75 0 01.02-1.06z" clip-rule="evenodd"/></svg>
      </a>
      <a href="/jobs" class="cat-nav-link flex items-center gap-1.5 <?= ($activeNav ?? '') === 'jobs' ? 'active' : '' ?>">
        <span class="text-base">🗂</span>전체
      </a>
      <a href="/jobs?businessType=designer" class="cat-nav-link">디자인</a>
      <a href="/community?category=tip" class="cat-nav-link">노하우</a>
      <a href="/jobs?businessType=studio" class="cat-nav-link">스튜디오</a>
      <a href="/jobs?businessType=makeup" class="cat-nav-link">메이크업</a>
      <a href="/jobs?businessType=planner" class="cat-nav-link">플래너</a>
      <a href="/jobs?businessType=mc" class="cat-nav-link">사회·축가</a>
      <a href="/jobs/new" class="cat-nav-link">공고 등록</a>
      <a href="/directory" class="cat-nav-link ml-auto <?= ($activeNav ?? '') === 'directory' ? 'active' : '' ?>">디렉토리</a>
      <a href="/community" class="cat-nav-link <?= ($activeNav ?? '') === 'community' ? 'active' : '' ?>">커뮤니티</a>
      <a href="/jobs/new" class="cat-nav-link">Marié Biz</a>
    </div>
  </div>
  <?php endif; ?>
</header>

<?php if ($flashSuccess = flash('success')): ?>
  <div class="max-w-[1280px] mx-auto px-5 mt-3"><div class="rounded-lg border border-green-200 bg-green-50 text-green-800 text-sm px-4 py-3"><?= View::e($flashSuccess) ?></div></div>
<?php endif; ?>
<?php if ($flashError = flash('error')): ?>
  <div class="max-w-[1280px] mx-auto px-5 mt-3"><div class="rounded-lg border border-red-200 bg-red-50 text-red-800 text-sm px-4 py-3"><?= View::e($flashError) ?></div></div>
<?php endif; ?>

<main>
