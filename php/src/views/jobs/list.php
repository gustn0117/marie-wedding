<?php /** @var array $jobs */ /** @var array $filters */ /** @var int $page */
View::share('showCatNav', true);
View::share('activeNav', 'jobs');
?>

<div class="max-w-[1280px] mx-auto px-5 py-8">
  <div class="flex flex-wrap items-end justify-between gap-3 mb-6">
    <div>
      <h1 class="text-[26px] font-extrabold text-ink tracking-tight"><?= ($filters['type'] ?? '') === 'matching' ? '파트너 섭외' : '채용 정보' ?></h1>
      <p class="mt-1 text-sm text-gray-500">총 <span class="font-bold text-ink"><?= count($jobs) ?></span>건</p>
    </div>
    <?php if (Auth::check()): ?>
      <a href="/jobs/new" class="btn-primary text-sm">+ 공고 등록</a>
    <?php endif; ?>
  </div>

  <!-- 필터 + 정렬 -->
  <div class="flex flex-wrap items-center justify-between gap-3 mb-6">
    <form action="/jobs" method="GET" class="flex flex-wrap gap-2 items-center">
      <?php if (!empty($filters['type'])): ?><input type="hidden" name="type" value="<?= View::e($filters['type']) ?>"><?php endif; ?>
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
      <select name="employmentType" onchange="this.form.submit()" class="px-3 h-9 rounded-full border border-gray-300 bg-white text-sm font-semibold hover:border-ink">
        <option value="">고용형태 전체</option>
        <?php foreach (['full_time'=>'정규직','contract'=>'계약직','part_time'=>'단기알바'] as $k=>$v): ?>
          <option value="<?= $k ?>" <?= ($filters['employmentType']??'')===$k?'selected':'' ?>><?= $v ?></option>
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
      <span class="font-bold text-ink">최신순</span>
      <span class="text-gray-300">|</span>
      <span class="hover:text-ink cursor-pointer">인기순</span>
      <span class="text-gray-300">|</span>
      <span class="hover:text-ink cursor-pointer">마감임박순</span>
    </div>
  </div>

  <?php if (empty($jobs)): ?>
    <div class="rounded-2xl border-2 border-dashed border-gray-200 bg-white p-16 text-center">
      <p class="text-sm text-gray-500 mb-4">조건에 맞는 공고가 없습니다.</p>
      <a href="/jobs" class="btn-outline">필터 초기화</a>
    </div>
  <?php else: ?>
    <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-x-4 gap-y-8">
      <?php foreach ($jobs as $idx => $job):
        $isExpired = !empty($job['deadline']) && strtotime($job['deadline']) < time();
        $name = $job['author']['company_name'] ?? $job['author']['contact_name'] ?? '업체명 미등록';
        $verified = ($job['author']['verification_status'] ?? '') === 'verified';
        $gradients = ['from-rose-100 to-orange-100', 'from-amber-100 to-yellow-100', 'from-emerald-100 to-teal-100', 'from-sky-100 to-indigo-100', 'from-fuchsia-100 to-pink-100', 'from-violet-100 to-purple-100', 'from-lime-100 to-emerald-100', 'from-cyan-100 to-sky-100'];
        $g = $gradients[$idx % 8];
        $emojis = ['💍','👗','📸','💄','📋','🎀','🎤','🎵','✏️'];
      ?>
        <a href="/jobs/<?= View::e($job['id']) ?>" class="svc-card">
          <div class="svc-card-thumb bg-gradient-to-br <?= $g ?>">
            <?php if ($isExpired): ?>
              <span class="svc-card-badge" style="background:#6b7280">마감</span>
            <?php elseif (!empty($job['is_promoted'])): ?>
              <span class="svc-card-badge promoted">PROMOTED</span>
            <?php elseif ($idx < 2): ?>
              <span class="svc-card-badge prime">prime</span>
            <?php endif; ?>
            <div class="absolute inset-0 flex items-center justify-center text-7xl opacity-30"><?= $emojis[$idx % 9] ?></div>
          </div>
          <p class="svc-card-title"><?= View::e($job['title']) ?></p>
          <div class="svc-card-rating">
            <span class="star">★</span>
            <span class="font-bold"><?= number_format(4.5 + ($idx % 5) * 0.1, 1) ?></span>
            <span class="count">(<?= number_format($job['view_count'] ?? rand(15, 200)) ?>)</span>
          </div>
          <p class="svc-card-price"><?= View::e($job['salary_info'] ?: '면접 후 결정') ?></p>
          <div class="svc-card-seller">
            <span class="truncate"><?= View::e($name) ?></span>
            <?php if ($verified): ?><span class="m-badge">M</span><?php endif; ?>
          </div>
        </a>
      <?php endforeach; ?>
    </div>

    <?php if (count($jobs) === 20): ?>
      <div class="mt-12 flex justify-center gap-2">
        <?php $qs = $_GET; if ($page > 1): $qs['page'] = $page - 1; ?>
          <a href="?<?= http_build_query($qs) ?>" class="btn-outline">이전</a>
        <?php endif; $qs['page'] = $page + 1; ?>
        <a href="?<?= http_build_query($qs) ?>" class="btn-primary">다음</a>
      </div>
    <?php endif; ?>
  <?php endif; ?>
</div>
