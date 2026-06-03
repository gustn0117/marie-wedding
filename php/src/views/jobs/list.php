<?php /** @var array $jobs */ /** @var array $filters */ /** @var int $page */ ?>

<div class="max-w-[1200px] mx-auto px-4 py-10">
  <div class="mb-8">
    <h1 class="text-3xl font-bold text-gray-900 tracking-tight"><?= ($filters['type'] ?? '') === 'matching' ? '파트너 섭외' : '채용 정보' ?></h1>
    <p class="mt-2 text-sm text-gray-500">총 <span class="font-bold text-gray-900"><?= count($jobs) ?></span>건의 공고</p>
  </div>

  <form action="/jobs" method="GET" class="rounded-xl border border-gray-200 bg-white p-4 mb-6">
    <?php if (!empty($filters['type'])): ?><input type="hidden" name="type" value="<?= View::e($filters['type']) ?>"><?php endif; ?>
    <div class="flex flex-wrap gap-2 items-center">
      <input type="text" name="search" value="<?= View::e($filters['search'] ?? '') ?>" placeholder="공고 제목 검색" class="input flex-1 min-w-[200px]">
      <select name="region" class="input w-auto">
        <option value="">지역 전체</option>
        <?php foreach (['seoul'=>'서울','gyeonggi'=>'경기','incheon'=>'인천','busan'=>'부산','daegu'=>'대구','jeju'=>'제주'] as $k=>$v): ?>
          <option value="<?= $k ?>" <?= ($filters['region']??'')===$k?'selected':'' ?>><?= $v ?></option>
        <?php endforeach; ?>
      </select>
      <select name="businessType" class="input w-auto">
        <option value="">업종 전체</option>
        <?php foreach (['venue'=>'예식장','dress'=>'드레스샵','studio'=>'스튜디오','makeup'=>'메이크업','planner'=>'웨딩플래너'] as $k=>$v): ?>
          <option value="<?= $k ?>" <?= ($filters['businessType']??'')===$k?'selected':'' ?>><?= $v ?></option>
        <?php endforeach; ?>
      </select>
      <button type="submit" class="btn-primary px-6">검색</button>
    </div>
  </form>

  <?php if (empty($jobs)): ?>
    <div class="rounded-xl border-2 border-dashed border-gray-200 bg-white p-16 text-center">
      <p class="text-sm text-gray-500 mb-4">조건에 맞는 공고가 없습니다.</p>
      <a href="/jobs" class="btn-outline">필터 초기화</a>
    </div>
  <?php else: ?>
    <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      <?php foreach ($jobs as $job): $isExpired = !empty($job['deadline']) && strtotime($job['deadline']) < time(); ?>
        <a href="/jobs/<?= View::e($job['id']) ?>" class="card flex flex-col gap-3">
          <div class="flex items-start justify-between gap-2">
            <p class="text-[13px] font-semibold text-gray-500 truncate"><?= View::e($job['author']['company_name'] ?? $job['author']['contact_name'] ?? '') ?></p>
            <?php if ($isExpired): ?><span class="rounded-full bg-gray-100 text-gray-500 text-[11px] font-semibold px-2 py-0.5 shrink-0">마감</span><?php endif; ?>
          </div>
          <h3 class="text-[17px] font-bold text-gray-900 leading-snug line-clamp-2 min-h-[44px]"><?= View::e($job['title']) ?></h3>
          <div class="flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px] text-gray-600">
            <span class="font-medium"><?= View::e(region_label($job['region'] ?? '')) ?></span>
            <span class="text-gray-300">·</span>
            <span><?= View::e(employment_label($job['employment_type'] ?? '')) ?></span>
            <span class="text-gray-300">·</span>
            <span><?= View::e(business_label($job['business_type'] ?? '')) ?></span>
          </div>
          <?php if (!empty($job['salary_info'])): ?>
            <p class="text-[13px] text-gray-700"><span class="text-gray-400 mr-1">급여</span><span class="font-semibold"><?= View::e($job['salary_info']) ?></span></p>
          <?php endif; ?>
          <div class="pt-2 mt-auto border-t border-gray-100 text-xs text-gray-400 flex items-center justify-between">
            <span><?= View::e(relative_time($job['created_at'] ?? '')) ?></span>
            <?php if (!empty($job['view_count'])): ?><span>조회 <?= number_format($job['view_count']) ?></span><?php endif; ?>
          </div>
        </a>
      <?php endforeach; ?>
    </div>

    <?php if (count($jobs) === 20): ?>
      <div class="mt-8 flex justify-center gap-2">
        <?php $qs = $_GET; if ($page > 1): $qs['page'] = $page - 1; ?>
          <a href="?<?= http_build_query($qs) ?>" class="btn-outline">이전</a>
        <?php endif; $qs['page'] = $page + 1; ?>
        <a href="?<?= http_build_query($qs) ?>" class="btn-primary">다음</a>
      </div>
    <?php endif; ?>
  <?php endif; ?>
</div>
