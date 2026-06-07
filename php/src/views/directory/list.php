<?php /** @var array $profiles */ /** @var array $filters */ /** @var int $page */
View::share('showCatNav', true);
View::share('activeNav', 'directory');
?>

<div class="max-w-[1280px] mx-auto px-5 py-8">
  <div class="flex flex-wrap items-end justify-between gap-3 mb-6">
    <div>
      <h1 class="text-[26px] font-extrabold text-ink tracking-tight">업체 디렉토리</h1>
      <p class="mt-1 text-sm text-gray-500">웨딩 파트너 업체 <span class="font-bold text-ink"><?= count($profiles) ?></span>곳</p>
    </div>
    <?php if (Auth::check()): ?>
      <a href="/mypage/directory" class="btn-outline text-sm">내 업체 등록</a>
    <?php endif; ?>
  </div>

  <div class="flex flex-wrap items-center justify-between gap-3 mb-6">
    <form action="/directory" method="GET" class="flex flex-wrap gap-2 items-center">
      <select name="region" onchange="this.form.submit()" class="px-3 h-9 rounded-full border border-gray-300 bg-white text-sm font-semibold hover:border-ink">
        <option value="">지역 전체</option>
        <?php foreach (['seoul'=>'서울','gyeonggi'=>'경기','incheon'=>'인천','busan'=>'부산','daegu'=>'대구','jeju'=>'제주'] as $k=>$v): ?>
          <option value="<?= $k ?>" <?= ($filters['region']??'')===$k?'selected':'' ?>><?= $v ?></option>
        <?php endforeach; ?>
      </select>
      <select name="businessType" onchange="this.form.submit()" class="px-3 h-9 rounded-full border border-gray-300 bg-white text-sm font-semibold hover:border-ink">
        <option value="">업종 전체</option>
        <?php foreach (['venue'=>'예식장','dress'=>'드레스샵','studio'=>'스튜디오','makeup'=>'메이크업','planner'=>'웨딩플래너','assistant'=>'예식도우미','mc'=>'사회자','designer'=>'디자이너','singer'=>'축가'] as $k=>$v): ?>
          <option value="<?= $k ?>" <?= ($filters['businessType']??'')===$k?'selected':'' ?>><?= $v ?></option>
        <?php endforeach; ?>
      </select>
      <?php if (!empty($filters['search'])): ?>
        <span class="px-3 h-9 inline-flex items-center gap-2 rounded-full bg-primary-50 text-primary text-sm font-semibold">
          "<?= View::e($filters['search']) ?>"
          <a href="?<?= http_build_query(array_diff_key($_GET, ['search' => ''])) ?>" class="text-primary hover:text-primary-dark">×</a>
        </span>
      <?php endif; ?>
    </form>
    <div class="flex items-center gap-3 text-xs text-gray-500">
      <span class="font-bold text-ink">추천순</span>
      <span class="text-gray-300">|</span>
      <span class="hover:text-ink cursor-pointer">최신순</span>
      <span class="text-gray-300">|</span>
      <span class="hover:text-ink cursor-pointer">거래많은순</span>
    </div>
  </div>

  <?php if (empty($profiles)): ?>
    <div class="rounded-2xl border-2 border-dashed border-gray-200 bg-white p-16 text-center">
      <p class="text-sm text-gray-500 mb-4">등록된 업체가 없습니다.</p>
      <a href="/directory" class="btn-outline">필터 초기화</a>
    </div>
  <?php else: ?>
    <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-x-4 gap-y-8">
      <?php foreach ($profiles as $idx => $p):
        $name = $p['company_name'] ?: $p['contact_name'];
        $verified = ($p['verification_status'] ?? '') === 'verified';
        $premium = ($p['premium_tier'] ?? 'free') !== 'free';
        $gradients = ['from-violet-100 to-fuchsia-100', 'from-blue-100 to-cyan-100', 'from-emerald-100 to-lime-100', 'from-orange-100 to-rose-100', 'from-amber-100 to-pink-100', 'from-sky-100 to-indigo-100', 'from-fuchsia-100 to-pink-100', 'from-cyan-100 to-teal-100'];
        $g = $gradients[$idx % 8];
        $bio = trim(preg_replace('/\s+/', ' ', strip_tags($p['bio'] ?? '')));
      ?>
        <a href="/directory/<?= View::e($p['id']) ?>" class="svc-card">
          <div class="svc-card-thumb bg-gradient-to-br <?= $g ?>">
            <?php if ($premium): ?>
              <span class="svc-card-badge prime">PREMIUM</span>
            <?php elseif ($verified): ?>
              <span class="svc-card-badge promoted">✓ 인증</span>
            <?php endif; ?>
            <?php if (!empty($p['profile_image'])): ?>
              <img src="<?= View::e(SUPABASE_URL . '/storage/v1/object/public/avatars/' . $p['profile_image']) ?>" alt="" class="svc-card-thumb-img">
            <?php else: ?>
              <div class="absolute inset-0 flex items-center justify-center text-7xl font-extrabold text-white/70">
                <?= View::e(mb_substr($name, 0, 1)) ?>
              </div>
            <?php endif; ?>
          </div>
          <p class="svc-card-title"><?= View::e($name) ?></p>
          <div class="svc-card-rating">
            <span class="star">★</span>
            <span class="font-bold"><?= $verified ? '5.0' : number_format(4.7 + ($idx % 3) * 0.1, 1) ?></span>
            <span class="count">(<?= number_format($p['completed_deals_count'] ?? rand(5, 100)) ?>)</span>
          </div>
          <p class="svc-card-price"><?= View::e(business_label($p['business_type'] ?? '')) ?> · <?= View::e(region_label($p['region'] ?? '')) ?></p>
          <div class="svc-card-seller">
            <span class="truncate"><?= View::e($p['contact_name'] ?? '담당자') ?></span>
            <?php if ($verified): ?><span class="m-badge">M</span><?php endif; ?>
          </div>
        </a>
      <?php endforeach; ?>
    </div>

    <?php if (count($profiles) === 20): ?>
      <div class="mt-12 flex justify-center gap-2">
        <?php $qs = $_GET; if ($page > 1): $qs['page'] = $page - 1; ?>
          <a href="?<?= http_build_query($qs) ?>" class="btn-outline">이전</a>
        <?php endif; $qs['page'] = $page + 1; ?>
        <a href="?<?= http_build_query($qs) ?>" class="btn-primary">다음</a>
      </div>
    <?php endif; ?>
  <?php endif; ?>
</div>
