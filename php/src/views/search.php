<?php /** @var string $q */ /** @var array $jobs */ /** @var array $profiles */ /** @var array $posts */
$total = count($jobs) + count($profiles) + count($posts);
?>

<div class="max-w-[1000px] mx-auto px-4 py-10">
  <?php if (!$q): ?>
    <div class="text-center py-16">
      <h1 class="text-2xl font-bold text-gray-900 mb-3">검색</h1>
      <form action="/search" method="GET" class="max-w-md mx-auto flex h-12 overflow-hidden rounded-2xl border-2 border-gray-200 bg-white focus-within:border-primary">
        <input type="text" name="q" placeholder="검색어를 입력하세요" autofocus class="min-w-0 flex-1 px-4 outline-none">
        <button type="submit" class="bg-primary px-6 text-sm font-semibold text-white">검색</button>
      </form>
    </div>
  <?php else: ?>
    <div class="mb-6">
      <h1 class="text-2xl font-bold text-gray-900">&ldquo;<?= View::e($q) ?>&rdquo; 검색 결과</h1>
      <p class="text-sm text-gray-500 mt-1">총 <span class="font-bold text-gray-900"><?= $total ?></span>건</p>
    </div>

    <?php if ($total === 0): ?>
      <div class="rounded-xl border-2 border-dashed border-gray-200 bg-white p-16 text-center">
        <p class="text-sm text-gray-500">검색 결과가 없습니다.</p>
      </div>
    <?php else: ?>
      <div class="space-y-8">

        <?php if (!empty($jobs)): ?>
        <section>
          <div class="flex items-end justify-between mb-3">
            <h2 class="text-lg font-bold text-gray-900">채용 공고 <span class="text-primary"><?= count($jobs) ?></span></h2>
            <a href="/jobs?search=<?= urlencode($q) ?>" class="text-xs text-gray-500 hover:text-primary">전체보기 →</a>
          </div>
          <div class="rounded-xl border border-gray-200 bg-white divide-y divide-gray-100">
            <?php foreach ($jobs as $j): ?>
              <a href="/jobs/<?= View::e($j['id']) ?>" class="flex items-center justify-between gap-3 px-4 py-3 hover:bg-gray-50">
                <div class="min-w-0">
                  <p class="text-sm font-bold text-gray-900 truncate"><?= View::e($j['title']) ?></p>
                  <p class="text-xs text-gray-500 mt-0.5"><?= View::e($j['author']['company_name'] ?? '') ?> · <?= View::e(region_label($j['region']??'')) ?> · <?= View::e(employment_label($j['employment_type']??'')) ?></p>
                </div>
                <span class="text-xs text-gray-400 shrink-0"><?= View::e(relative_time($j['created_at']??'')) ?></span>
              </a>
            <?php endforeach; ?>
          </div>
        </section>
        <?php endif; ?>

        <?php if (!empty($profiles)): ?>
        <section>
          <div class="flex items-end justify-between mb-3">
            <h2 class="text-lg font-bold text-gray-900">업체 <span class="text-primary"><?= count($profiles) ?></span></h2>
            <a href="/directory?search=<?= urlencode($q) ?>" class="text-xs text-gray-500 hover:text-primary">전체보기 →</a>
          </div>
          <div class="rounded-xl border border-gray-200 bg-white divide-y divide-gray-100">
            <?php foreach ($profiles as $p): $name = $p['company_name'] ?: $p['contact_name']; ?>
              <a href="/directory/<?= View::e($p['id']) ?>" class="flex items-center gap-3 px-4 py-3 hover:bg-gray-50">
                <div class="w-10 h-10 rounded-lg bg-gray-50 flex items-center justify-center overflow-hidden shrink-0">
                  <?php if (!empty($p['profile_image'])): ?>
                    <img src="<?= View::e(SUPABASE_URL . '/storage/v1/object/public/avatars/' . $p['profile_image']) ?>" alt="" class="w-full h-full object-cover">
                  <?php else: ?>
                    <span class="font-bold text-gray-400"><?= View::e(mb_substr($name, 0, 1)) ?></span>
                  <?php endif; ?>
                </div>
                <div class="min-w-0 flex-1">
                  <p class="text-sm font-bold text-gray-900 truncate"><?= View::e($name) ?></p>
                  <p class="text-xs text-gray-500 mt-0.5"><?= View::e(business_label($p['business_type']??'')) ?> · <?= View::e(region_label($p['region']??'')) ?></p>
                </div>
              </a>
            <?php endforeach; ?>
          </div>
        </section>
        <?php endif; ?>

        <?php if (!empty($posts)): ?>
        <section>
          <div class="flex items-end justify-between mb-3">
            <h2 class="text-lg font-bold text-gray-900">커뮤니티 <span class="text-primary"><?= count($posts) ?></span></h2>
            <a href="/community?search=<?= urlencode($q) ?>" class="text-xs text-gray-500 hover:text-primary">전체보기 →</a>
          </div>
          <div class="rounded-xl border border-gray-200 bg-white divide-y divide-gray-100">
            <?php foreach ($posts as $post): ?>
              <a href="/community/<?= View::e($post['id']) ?>" class="flex items-center justify-between gap-3 px-4 py-3 hover:bg-gray-50">
                <div class="min-w-0">
                  <p class="text-sm font-bold text-gray-900 truncate"><?= View::e($post['title']) ?></p>
                  <p class="text-xs text-gray-500 mt-0.5">조회 <?= number_format($post['view_count']??0) ?> · 좋아요 <?= number_format($post['like_count']??0) ?></p>
                </div>
                <span class="text-xs text-gray-400 shrink-0"><?= View::e(relative_time($post['created_at']??'')) ?></span>
              </a>
            <?php endforeach; ?>
          </div>
        </section>
        <?php endif; ?>

      </div>
    <?php endif; ?>
  <?php endif; ?>
</div>
