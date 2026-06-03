<?php /** @var array $applications */
$statusLabels = [
  'submitted' => ['신청 완료', 'bg-gray-100 text-gray-700'],
  'reviewed' => ['검토중', 'bg-yellow-100 text-yellow-800'],
  'accepted' => ['수락됨', 'bg-green-100 text-green-800'],
  'rejected' => ['거절됨', 'bg-red-100 text-red-700'],
  'completed' => ['완료', 'bg-primary text-white'],
];
?>
<div class="max-w-[1000px] mx-auto px-4 py-8">
  <h1 class="text-3xl font-bold text-gray-900 mb-6 tracking-tight">신청 내역</h1>
  <?php $active = 'applications'; require __DIR__ . '/_nav.php'; ?>

  <?php if (empty($applications)): ?>
    <div class="rounded-xl border-2 border-dashed border-gray-200 bg-white p-16 text-center">
      <p class="text-sm text-gray-500 mb-4">아직 신청한 공고가 없습니다.</p>
      <a href="/jobs" class="btn-primary inline-flex">공고 둘러보기</a>
    </div>
  <?php else: ?>
    <div class="rounded-xl border border-gray-200 bg-white divide-y divide-gray-100 overflow-hidden">
      <?php foreach ($applications as $app): $job = $app['job'] ?? null; $status = $statusLabels[$app['status'] ?? 'submitted'] ?? $statusLabels['submitted']; ?>
        <div class="flex items-center justify-between gap-3 px-5 py-4">
          <div class="min-w-0 flex-1">
            <div class="flex items-center gap-2 mb-1">
              <span class="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold <?= $status[1] ?>"><?= $status[0] ?></span>
            </div>
            <?php if ($job && empty($job['deleted_at'])): ?>
              <a href="/jobs/<?= View::e($job['id']) ?>" class="text-sm font-bold text-gray-900 hover:text-primary truncate block"><?= View::e($job['title']) ?></a>
              <p class="text-xs text-gray-500 mt-1">
                <?= View::e(region_label($job['region'] ?? '')) ?>
                · <?= View::e(employment_label($job['employment_type'] ?? '')) ?>
                · 신청 <?= View::e(format_date($app['created_at'] ?? '')) ?>
              </p>
            <?php else: ?>
              <p class="text-sm font-bold text-gray-400">삭제된 공고</p>
              <p class="text-xs text-gray-400 mt-1">신청 <?= View::e(format_date($app['created_at'] ?? '')) ?></p>
            <?php endif; ?>
          </div>
        </div>
      <?php endforeach; ?>
    </div>
  <?php endif; ?>
</div>
