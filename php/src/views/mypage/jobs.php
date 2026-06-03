<?php /** @var array $jobs */ ?>
<div class="max-w-[1000px] mx-auto px-4 py-8">
  <h1 class="text-3xl font-bold text-gray-900 mb-6 tracking-tight">내 공고</h1>
  <?php $active = 'jobs'; require __DIR__ . '/_nav.php'; ?>

  <div class="flex justify-end mb-4">
    <a href="/jobs/new" class="btn-primary text-sm">+ 새 공고</a>
  </div>

  <?php if (empty($jobs)): ?>
    <div class="rounded-xl border-2 border-dashed border-gray-200 bg-white p-16 text-center">
      <p class="text-sm text-gray-500 mb-4">등록한 공고가 없습니다.</p>
      <a href="/jobs/new" class="btn-primary inline-flex">첫 공고 등록</a>
    </div>
  <?php else: ?>
    <div class="rounded-xl border border-gray-200 bg-white divide-y divide-gray-100 overflow-hidden">
      <?php foreach ($jobs as $j): $expired = !empty($j['deadline']) && strtotime($j['deadline']) < time(); ?>
        <a href="/jobs/<?= View::e($j['id']) ?>" class="flex items-center justify-between gap-3 px-5 py-4 hover:bg-gray-50">
          <div class="min-w-0">
            <div class="flex items-center gap-2 mb-1">
              <p class="text-sm font-bold text-gray-900 truncate"><?= View::e($j['title']) ?></p>
              <?php if ($expired): ?><span class="rounded-full bg-gray-100 text-gray-500 text-[10px] font-bold px-1.5 py-0.5">마감</span><?php endif; ?>
            </div>
            <p class="text-xs text-gray-500">
              <?= View::e(employment_label($j['employment_type']??'')) ?> · <?= View::e(region_label($j['region']??'')) ?>
              · <?= View::e(format_date($j['created_at']??'')) ?>
            </p>
          </div>
          <div class="text-right shrink-0">
            <p class="text-xs text-gray-400">조회</p>
            <p class="text-sm font-bold text-gray-900 tabular-nums"><?= number_format($j['view_count']??0) ?></p>
          </div>
        </a>
      <?php endforeach; ?>
    </div>
  <?php endif; ?>
</div>
