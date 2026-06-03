<?php /** @var array $posts */ /** @var array $filters */ /** @var int $page */ /** @var array $categories */
$activeCat = $filters['category'] ?? '';
$activeSort = $filters['sort'] ?? 'recent';
?>

<div class="max-w-[1000px] mx-auto px-4 py-10">
  <div class="flex flex-wrap items-end justify-between gap-3 mb-6">
    <div>
      <h1 class="text-3xl font-bold text-gray-900 tracking-tight">커뮤니티</h1>
      <p class="mt-2 text-sm text-gray-500">웨딩 업계 현장의 노하우를 나누세요</p>
    </div>
    <?php if (Auth::check()): ?>
      <a href="/community/write" class="btn-primary text-sm">글쓰기</a>
    <?php else: ?>
      <a href="/login" class="btn-outline text-sm">로그인 후 글쓰기</a>
    <?php endif; ?>
  </div>

  <!-- 카테고리 + 정렬 + 검색 -->
  <div class="mb-6 flex flex-wrap items-center justify-between gap-3 border-b border-gray-200 pb-3">
    <div class="flex flex-wrap items-center gap-1 text-sm">
      <?php foreach ($categories as $k => $v): $isActive = ($activeCat === $k); $qs = array_merge($_GET, ['category' => $k]); ?>
        <a href="?<?= http_build_query(array_filter($qs)) ?>" class="px-3 py-1.5 rounded-full font-semibold <?= $isActive ? 'bg-primary text-white' : 'text-gray-600 hover:bg-gray-100' ?>"><?= View::e($v) ?></a>
      <?php endforeach; ?>
    </div>
    <div class="flex items-center gap-2 text-xs text-gray-500">
      <?php foreach (['recent' => '최신순', 'popular' => '인기순', 'comments' => '댓글많은순'] as $k => $v): $qs = array_merge($_GET, ['sort' => $k]); ?>
        <a href="?<?= http_build_query($qs) ?>" class="font-semibold <?= $activeSort === $k ? 'text-primary' : 'hover:text-gray-900' ?>"><?= $v ?></a>
        <?php if ($k !== 'comments'): ?><span class="text-gray-300">|</span><?php endif; ?>
      <?php endforeach; ?>
    </div>
  </div>

  <form action="/community" method="GET" class="mb-6">
    <?php if (!empty($filters['category'])): ?><input type="hidden" name="category" value="<?= View::e($filters['category']) ?>"><?php endif; ?>
    <div class="flex gap-2">
      <input type="text" name="search" value="<?= View::e($filters['search'] ?? '') ?>" placeholder="제목으로 검색" class="input flex-1">
      <button type="submit" class="btn-primary px-6">검색</button>
    </div>
  </form>

  <?php if (empty($posts)): ?>
    <div class="rounded-xl border-2 border-dashed border-gray-200 bg-white p-16 text-center">
      <p class="text-sm text-gray-500 mb-4">게시글이 없습니다.</p>
      <?php if (Auth::check()): ?>
        <a href="/community/write" class="btn-primary inline-flex">첫 글 작성하기</a>
      <?php endif; ?>
    </div>
  <?php else: ?>
    <ul class="rounded-xl border border-gray-200 bg-white divide-y divide-gray-100 overflow-hidden">
      <?php foreach ($posts as $post): $author = $post['author'] ?? []; ?>
        <li><a href="/community/<?= View::e($post['id']) ?>" class="block px-5 py-4 hover:bg-gray-50">
          <div class="flex items-center gap-2 mb-1.5">
            <span class="inline-flex items-center px-2 py-0.5 rounded-full bg-primary-50 text-primary text-[11px] font-bold"><?= View::e($categories[$post['category']] ?? $post['category']) ?></span>
            <?php if (($post['comment_count'] ?? 0) > 0): ?>
              <span class="text-xs text-primary font-bold">[<?= number_format($post['comment_count']) ?>]</span>
            <?php endif; ?>
          </div>
          <h3 class="text-[16px] font-bold text-gray-900 leading-snug line-clamp-1"><?= View::e($post['title']) ?></h3>
          <?php $preview = trim(preg_replace('/\s+/', ' ', strip_tags($post['content'] ?? ''))); if ($preview): ?>
            <p class="mt-1 text-sm text-gray-500 line-clamp-1"><?= View::e(mb_substr($preview, 0, 120)) ?></p>
          <?php endif; ?>
          <div class="mt-2 flex items-center gap-3 text-xs text-gray-500">
            <span class="font-medium text-gray-700"><?= View::e($author['company_name'] ?? $author['contact_name'] ?? '익명') ?></span>
            <span><?= View::e(relative_time($post['created_at'] ?? '')) ?></span>
            <span class="text-gray-300">·</span>
            <span>조회 <?= number_format($post['view_count'] ?? 0) ?></span>
            <?php if (($post['like_count'] ?? 0) > 0): ?>
              <span class="text-gray-300">·</span>
              <span>좋아요 <?= number_format($post['like_count']) ?></span>
            <?php endif; ?>
          </div>
        </a></li>
      <?php endforeach; ?>
    </ul>

    <?php if (count($posts) === 20): ?>
      <div class="mt-8 flex justify-center gap-2">
        <?php $qs = $_GET; if ($page > 1): $qs['page'] = $page - 1; ?>
          <a href="?<?= http_build_query($qs) ?>" class="btn-outline">이전</a>
        <?php endif; $qs['page'] = $page + 1; ?>
        <a href="?<?= http_build_query($qs) ?>" class="btn-primary">다음</a>
      </div>
    <?php endif; ?>
  <?php endif; ?>
</div>
