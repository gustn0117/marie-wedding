<?php /** @var array $posts */
$catLabels = ['qna' => '질문', 'tip' => '노하우', 'review' => '후기', 'discussion' => '토론', 'event' => '이벤트', 'free' => '자유'];
?>
<div class="max-w-[1000px] mx-auto px-4 py-8">
  <h1 class="text-3xl font-bold text-gray-900 mb-6 tracking-tight">내 글</h1>
  <?php $active = 'posts'; require __DIR__ . '/_nav.php'; ?>

  <div class="flex justify-end mb-4">
    <a href="/community/write" class="btn-primary text-sm">+ 글쓰기</a>
  </div>

  <?php if (empty($posts)): ?>
    <div class="rounded-xl border-2 border-dashed border-gray-200 bg-white p-16 text-center">
      <p class="text-sm text-gray-500 mb-4">작성한 글이 없습니다.</p>
      <a href="/community/write" class="btn-primary inline-flex">첫 글 작성</a>
    </div>
  <?php else: ?>
    <div class="rounded-xl border border-gray-200 bg-white divide-y divide-gray-100 overflow-hidden">
      <?php foreach ($posts as $p): ?>
        <a href="/community/<?= View::e($p['id']) ?>" class="block px-5 py-4 hover:bg-gray-50">
          <div class="flex items-center gap-2 mb-1">
            <span class="inline-flex items-center px-2 py-0.5 rounded-full bg-primary-50 text-primary text-[11px] font-bold"><?= View::e($catLabels[$p['category']] ?? $p['category']) ?></span>
          </div>
          <p class="text-sm font-bold text-gray-900 truncate"><?= View::e($p['title']) ?></p>
          <p class="text-xs text-gray-500 mt-1">
            <?= View::e(format_date($p['created_at']??'')) ?>
            · 조회 <?= number_format($p['view_count']??0) ?>
            · 좋아요 <?= number_format($p['like_count']??0) ?>
            · 댓글 <?= number_format($p['comment_count']??0) ?>
          </p>
        </a>
      <?php endforeach; ?>
    </div>
  <?php endif; ?>
</div>
