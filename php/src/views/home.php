<?php /** @var array $jobs */ /** @var array $profiles */ /** @var array $posts */ /** @var array $counts */
View::share('showCatNav', true);
View::share('activeNav', 'home');

$categories = [
  ['venue',     '예식장',     '🏰', 'BEST', 'best'],
  ['dress',     '드레스샵',   '👗', '업종별', null],
  ['studio',    '스튜디오',   '📸', null, null],
  ['makeup',    '메이크업',   '💄', null, null],
  ['planner',   '플래너',     '📋', null, null],
  ['assistant', '예식도우미', '🎀', null, null],
  ['mc',        '사회자',     '🎤', null, null],
  ['singer',    '축가',       '🎵', null, null],
  ['designer',  '디자이너',   '✏️', null, null],
  ['other',     '전체보기',   '⊞', null, null],
];
?>

<!-- Hero: 좌측 검색 / 우측 프로모 -->
<section class="bg-white">
  <div class="max-w-[1280px] mx-auto px-5 pt-12 pb-10">
    <div class="grid lg:grid-cols-[1fr_440px] gap-8 items-start">
      <!-- 검색 -->
      <div class="flex flex-col gap-6 pt-6">
        <h1 class="text-[34px] sm:text-[40px] font-extrabold leading-[1.2] tracking-tight text-ink">
          내 업체에 딱 맞는<br>
          웨딩 파트너를 찾아보세요
        </h1>
        <form action="/search" method="GET" class="flex h-14 sm:h-16 overflow-hidden rounded-2xl border-2 border-ink bg-white shadow-sm max-w-[600px]">
          <input type="text" name="q" placeholder="어떤 전문가가 필요하세요?" class="flex-1 min-w-0 px-5 text-[16px] outline-none placeholder:text-gray-400">
          <button type="submit" class="bg-white px-5 hover:bg-gray-50">
            <svg class="w-6 h-6 text-ink" fill="none" viewBox="0 0 24 24" stroke-width="2.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z"/></svg>
          </button>
        </form>
        <div class="flex flex-wrap gap-2 max-w-[600px]">
          <a href="/jobs?businessType=planner" class="hero-chip hero-chip-primary inline-flex items-center gap-1.5">
            <span class="text-base">📋</span> 플래너 모집
          </a>
          <a href="/jobs?type=matching" class="hero-chip hero-chip-primary inline-flex items-center gap-1.5">
            <span class="text-base">🤝</span> 파트너 섭외
          </a>
          <a href="/jobs?businessType=venue" class="hero-chip">예식장</a>
          <a href="/jobs?businessType=studio" class="hero-chip">스튜디오</a>
          <a href="/jobs?businessType=makeup" class="hero-chip">메이크업</a>
        </div>
      </div>

      <!-- 프로모 카드 -->
      <a href="/jobs?type=matching" class="promo-card hover:shadow-lg transition-shadow hidden lg:flex">
        <span class="promo-illust">💍</span>
        <div class="relative z-10">
          <h3>업체 섭외도<br>한 화면에서</h3>
          <p>섭외 비용을 절약하세요</p>
        </div>
        <span class="promo-page">2 / 6 →</span>
      </a>
    </div>

    <!-- 카테고리 아이콘 그리드 -->
    <div class="mt-12 grid grid-cols-5 md:grid-cols-10 gap-2 sm:gap-3">
      <?php foreach ($categories as [$key, $label, $icon, $badge, $type]):
        $bg = ['bg-rose-100','bg-pink-100','bg-amber-100','bg-fuchsia-100','bg-violet-100','bg-blue-100','bg-cyan-100','bg-emerald-100','bg-yellow-100','bg-gray-100'][array_search($key, array_column($categories, 0))];
        $href = $key === 'other' ? '/jobs' : '/jobs?businessType=' . $key;
      ?>
        <a href="<?= $href ?>" class="cat-tile">
          <?php if ($badge): ?>
            <span class="cat-tile-badge <?= $type === 'best' ? 'best' : '' ?>"><?= View::e($badge) ?></span>
          <?php endif; ?>
          <div class="cat-tile-icon <?= $bg ?>"><?= $icon ?></div>
          <span class="cat-tile-label"><?= View::e($label) ?></span>
        </a>
      <?php endforeach; ?>
    </div>
  </div>
</section>

<!-- 최신 채용·섭외 캐러셀 -->
<section class="bg-gray-50 py-12">
  <div class="max-w-[1280px] mx-auto px-5">
    <div class="flex items-end justify-between mb-6">
      <div>
        <h2 class="text-[22px] sm:text-[26px] font-extrabold tracking-tight text-ink">최근 등록된 공고</h2>
        <p class="mt-1 text-sm text-gray-500">놓치기 아까운 채용·섭외 기회</p>
      </div>
      <a href="/jobs" class="text-sm font-bold text-gray-500 hover:text-ink">전체보기 →</a>
    </div>

    <?php if (empty($jobs)): ?>
      <div class="rounded-2xl bg-white border-2 border-dashed border-gray-200 p-12 text-center">
        <p class="text-sm text-gray-500 mb-4">아직 등록된 공고가 없습니다.</p>
        <a href="/jobs/new" class="btn-primary inline-flex">공고 등록</a>
      </div>
    <?php else: ?>
      <div class="h-scroll">
        <?php foreach ($jobs as $idx => $job):
          $name = $job['author']['company_name'] ?? $job['author']['contact_name'] ?? '업체명 미등록';
          $verified = ($job['author']['verification_status'] ?? '') === 'verified';
          $gradients = ['from-rose-100 to-orange-100', 'from-amber-100 to-yellow-100', 'from-emerald-100 to-teal-100', 'from-sky-100 to-indigo-100', 'from-fuchsia-100 to-pink-100', 'from-violet-100 to-purple-100'];
          $g = $gradients[$idx % 6];
        ?>
          <a href="/jobs/<?= View::e($job['id']) ?>" class="svc-card">
            <div class="svc-card-thumb bg-gradient-to-br <?= $g ?>">
              <?php if (!empty($job['is_promoted']) || $idx === 0): ?>
                <span class="svc-card-badge <?= !empty($job['is_promoted']) ? 'promoted' : '' ?>"><?= !empty($job['is_promoted']) ? 'PROMOTED' : '최근 등록' ?></span>
              <?php endif; ?>
              <div class="absolute inset-0 flex items-center justify-center text-6xl opacity-40">
                <?php $emojis = ['💍','👗','📸','💄','📋','🎀','🎤','🎵']; echo $emojis[$idx % 8]; ?>
              </div>
            </div>
            <p class="svc-card-title"><?= View::e($job['title']) ?></p>
            <div class="svc-card-rating">
              <span class="star">★</span>
              <span class="font-bold"><?= number_format(4.5 + ($idx % 5) * 0.1, 1) ?></span>
              <span class="count">(<?= number_format($job['view_count'] ?? rand(20, 200)) ?>)</span>
            </div>
            <p class="svc-card-price"><?= View::e($job['salary_info'] ?: '면접 후 결정') ?></p>
            <div class="svc-card-seller">
              <span class="truncate"><?= View::e($name) ?></span>
              <?php if ($verified): ?><span class="m-badge">M</span><?php endif; ?>
            </div>
          </a>
        <?php endforeach; ?>
      </div>
    <?php endif; ?>
  </div>
</section>

<!-- 추천 업체 캐러셀 -->
<?php if (!empty($profiles)): ?>
<section class="bg-white py-12">
  <div class="max-w-[1280px] mx-auto px-5">
    <div class="flex items-end justify-between mb-6">
      <div>
        <h2 class="text-[22px] sm:text-[26px] font-extrabold tracking-tight text-ink">추천 파트너 업체</h2>
        <p class="mt-1 text-sm text-gray-500">신뢰할 수 있는 검증 업체 모음</p>
      </div>
      <a href="/directory" class="text-sm font-bold text-gray-500 hover:text-ink">전체보기 →</a>
    </div>

    <div class="h-scroll">
      <?php foreach ($profiles as $idx => $p):
        $name = $p['company_name'] ?: $p['contact_name'];
        $verified = ($p['verification_status'] ?? '') === 'verified';
        $premium = ($p['premium_tier'] ?? 'free') !== 'free';
        $gradients = ['from-violet-100 to-fuchsia-100', 'from-blue-100 to-cyan-100', 'from-emerald-100 to-lime-100', 'from-orange-100 to-rose-100', 'from-amber-100 to-pink-100'];
        $g = $gradients[$idx % 5];
      ?>
        <a href="/directory/<?= View::e($p['id']) ?>" class="svc-card">
          <div class="svc-card-thumb bg-gradient-to-br <?= $g ?>">
            <?php if ($premium): ?><span class="svc-card-badge prime">PREMIUM</span><?php endif; ?>
            <?php if (!empty($p['profile_image'])): ?>
              <img src="<?= View::e(SUPABASE_URL . '/storage/v1/object/public/avatars/' . $p['profile_image']) ?>" alt="" class="svc-card-thumb-img">
            <?php else: ?>
              <div class="absolute inset-0 flex items-center justify-center text-7xl font-extrabold text-white/60">
                <?= View::e(mb_substr($name, 0, 1)) ?>
              </div>
            <?php endif; ?>
          </div>
          <p class="svc-card-title"><?= View::e($name) ?></p>
          <div class="svc-card-rating">
            <span class="star">★</span>
            <span class="font-bold"><?= $verified ? '5.0' : '4.8' ?></span>
            <span class="count">(<?= number_format($p['completed_deals_count'] ?? rand(5, 50)) ?>)</span>
          </div>
          <p class="svc-card-price"><?= View::e(business_label($p['business_type'] ?? '')) ?> · <?= View::e(region_label($p['region'] ?? '')) ?></p>
          <div class="svc-card-seller">
            <span class="truncate"><?= View::e($p['contact_name'] ?? '담당자') ?></span>
            <?php if ($verified): ?><span class="m-badge">M</span><?php endif; ?>
          </div>
        </a>
      <?php endforeach; ?>
    </div>
  </div>
</section>
<?php endif; ?>

<!-- 메트릭 + 커뮤니티 -->
<section class="bg-gray-50 py-12">
  <div class="max-w-[1280px] mx-auto px-5 grid lg:grid-cols-[2fr_1fr] gap-8">
    <div>
      <div class="flex items-end justify-between mb-6">
        <div>
          <h2 class="text-[22px] sm:text-[26px] font-extrabold tracking-tight text-ink">커뮤니티 인기글</h2>
          <p class="mt-1 text-sm text-gray-500">웨딩 현장의 살아있는 노하우</p>
        </div>
        <a href="/community" class="text-sm font-bold text-gray-500 hover:text-ink">전체보기 →</a>
      </div>
      <?php if (empty($posts)): ?>
        <div class="rounded-2xl bg-white border-2 border-dashed border-gray-200 p-12 text-center">
          <p class="text-sm text-gray-500">첫 글의 주인공이 되어보세요.</p>
        </div>
      <?php else: ?>
        <div class="rounded-2xl bg-white border border-gray-200 overflow-hidden divide-y divide-gray-100">
          <?php foreach ($posts as $idx => $post): ?>
            <a href="/community/<?= View::e($post['id']) ?>" class="flex items-center gap-4 px-5 py-4 hover:bg-gray-50">
              <span class="w-7 text-center text-lg font-extrabold <?= $idx < 3 ? 'text-primary' : 'text-gray-400' ?>"><?= $idx + 1 ?></span>
              <div class="flex-1 min-w-0">
                <p class="text-sm font-bold text-ink line-clamp-1"><?= View::e($post['title']) ?></p>
                <p class="text-xs text-gray-500 mt-0.5">조회 <?= number_format($post['view_count'] ?? 0) ?> · 좋아요 <?= number_format($post['like_count'] ?? 0) ?></p>
              </div>
            </a>
          <?php endforeach; ?>
        </div>
      <?php endif; ?>
    </div>

    <aside>
      <div class="rounded-2xl bg-white border border-gray-200 p-6">
        <p class="text-xs font-bold text-gray-400 uppercase tracking-wider mb-4">실시간 지표</p>
        <div class="space-y-4">
          <div class="flex items-center justify-between">
            <span class="text-sm text-gray-700">인증 업체</span>
            <span class="text-xl font-extrabold text-ink tabular-nums"><?= number_format($counts['verified']) ?></span>
          </div>
          <div class="flex items-center justify-between pt-4 border-t border-gray-100">
            <span class="text-sm text-gray-700">최근 30일 공고</span>
            <span class="text-xl font-extrabold text-ink tabular-nums"><?= number_format($counts['recentJobs']) ?></span>
          </div>
          <div class="flex items-center justify-between pt-4 border-t border-gray-100">
            <span class="text-sm text-gray-700">활성 파트너</span>
            <span class="text-xl font-extrabold text-ink tabular-nums"><?= number_format($counts['profiles']) ?></span>
          </div>
        </div>
        <a href="/signup" class="btn-primary w-full mt-6">지금 무료로 시작</a>
      </div>
    </aside>
  </div>
</section>
