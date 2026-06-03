<?php /** @var array $post */ /** @var array $comments */
$author = $post['author'] ?? [];
$me = Auth::profile();
$isOwner = $me && $me['id'] === ($post['author_id'] ?? null);

$catLabels = ['qna' => '질문', 'tip' => '노하우', 'review' => '후기', 'discussion' => '토론', 'event' => '이벤트', 'free' => '자유'];

// 댓글 트리 구성
$top = [];
$replies = [];
foreach ($comments as $c) {
  if (empty($c['parent_id'])) $top[] = $c;
  else $replies[$c['parent_id']][] = $c;
}
?>

<div class="max-w-[800px] mx-auto px-4 py-8">
  <nav class="mb-4 text-sm text-gray-500">
    <a href="/community" class="hover:text-primary">커뮤니티</a>
    <span class="mx-2">›</span>
    <span class="text-gray-900 font-medium"><?= View::e($catLabels[$post['category']] ?? $post['category']) ?></span>
  </nav>

  <article class="rounded-xl border border-gray-200 bg-white p-6 md:p-8 mb-6">
    <div class="flex items-center gap-2 mb-3">
      <span class="inline-flex items-center px-2 py-0.5 rounded-full bg-primary-50 text-primary text-[11px] font-bold"><?= View::e($catLabels[$post['category']] ?? $post['category']) ?></span>
    </div>
    <h1 class="text-2xl md:text-3xl font-bold text-gray-900 leading-tight tracking-tight mb-5"><?= View::e($post['title']) ?></h1>

    <div class="flex items-center justify-between gap-3 pb-5 mb-5 border-b border-gray-100">
      <div class="flex items-center gap-3">
        <div class="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center overflow-hidden">
          <?php if (!empty($author['profile_image'])): ?>
            <img src="<?= View::e(SUPABASE_URL . '/storage/v1/object/public/avatars/' . $author['profile_image']) ?>" alt="" class="w-full h-full object-cover">
          <?php else: ?>
            <span class="font-bold text-gray-400"><?= View::e(mb_substr($author['company_name'] ?? $author['contact_name'] ?? '?', 0, 1)) ?></span>
          <?php endif; ?>
        </div>
        <div>
          <p class="text-sm font-bold text-gray-900 flex items-center gap-1">
            <?= View::e($author['company_name'] ?? $author['contact_name'] ?? '익명') ?>
            <?php if (($author['verification_status'] ?? '') === 'verified'): ?>
              <span class="inline-flex items-center px-1.5 py-0.5 bg-primary text-white text-[10px] font-bold rounded">✓</span>
            <?php endif; ?>
          </p>
          <p class="text-xs text-gray-500"><?= View::e(relative_time($post['created_at'] ?? '')) ?> · 조회 <?= number_format($post['view_count'] ?? 0) ?></p>
        </div>
      </div>
    </div>

    <div class="text-[15px] text-gray-800 leading-relaxed whitespace-pre-wrap"><?= View::e($post['content']) ?></div>

    <div class="mt-8 pt-5 border-t border-gray-100 flex items-center justify-between">
      <button id="like-btn" type="button" data-post-id="<?= View::e($post['id']) ?>" data-csrf="<?= csrf_token() ?>" class="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-gray-300 hover:border-primary hover:bg-primary-50 transition-colors">
        <span>👍</span>
        <span class="text-sm font-bold" id="like-count"><?= number_format($post['like_count'] ?? 0) ?></span>
      </button>
      <span class="text-xs text-gray-500">댓글 <?= number_format($post['comment_count'] ?? 0) ?></span>
    </div>
  </article>

  <!-- 댓글 -->
  <section id="comments" class="rounded-xl border border-gray-200 bg-white p-6 md:p-8">
    <h2 class="text-lg font-bold text-gray-900 mb-4 pb-3 border-b border-gray-200">
      댓글 <span class="text-primary"><?= count($comments) ?></span>
    </h2>

    <?php if (Auth::check()): ?>
      <form action="/community/<?= View::e($post['id']) ?>/comment" method="POST" class="mb-6">
        <input type="hidden" name="_csrf" value="<?= csrf_token() ?>">
        <textarea name="content" rows="3" required placeholder="댓글을 입력하세요" class="input resize-none mb-2"></textarea>
        <div class="flex justify-end">
          <button type="submit" class="btn-primary">댓글 등록</button>
        </div>
      </form>
    <?php else: ?>
      <div class="mb-6 rounded-lg bg-gray-50 px-4 py-3 text-sm text-gray-500 text-center">
        <a href="/login" class="font-semibold text-primary hover:underline">로그인</a> 후 댓글을 작성할 수 있습니다.
      </div>
    <?php endif; ?>

    <?php if (empty($top)): ?>
      <p class="py-8 text-center text-sm text-gray-400">첫 번째 댓글을 작성해 보세요.</p>
    <?php else: ?>
      <ul class="space-y-5">
        <?php foreach ($top as $c): $ca = $c['author'] ?? []; ?>
          <li>
            <div class="flex items-start gap-3">
              <div class="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center overflow-hidden shrink-0">
                <?php if (!empty($ca['profile_image'])): ?>
                  <img src="<?= View::e(SUPABASE_URL . '/storage/v1/object/public/avatars/' . $ca['profile_image']) ?>" alt="" class="w-full h-full object-cover">
                <?php else: ?>
                  <span class="font-bold text-gray-400 text-sm"><?= View::e(mb_substr($ca['company_name'] ?? $ca['contact_name'] ?? '?', 0, 1)) ?></span>
                <?php endif; ?>
              </div>
              <div class="flex-1 min-w-0">
                <div class="flex items-center gap-2 mb-1">
                  <p class="text-sm font-bold text-gray-900"><?= View::e($ca['company_name'] ?? $ca['contact_name'] ?? '익명') ?></p>
                  <p class="text-xs text-gray-400"><?= View::e(relative_time($c['created_at'] ?? '')) ?></p>
                </div>
                <p class="text-sm text-gray-800 leading-relaxed whitespace-pre-wrap"><?= View::e($c['content']) ?></p>

                <?php if (!empty($replies[$c['id']])): ?>
                  <ul class="mt-3 ml-3 pl-4 border-l-2 border-gray-100 space-y-3">
                    <?php foreach ($replies[$c['id']] as $r): $ra = $r['author'] ?? []; ?>
                      <li class="flex items-start gap-3">
                        <div class="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center overflow-hidden shrink-0">
                          <?php if (!empty($ra['profile_image'])): ?>
                            <img src="<?= View::e(SUPABASE_URL . '/storage/v1/object/public/avatars/' . $ra['profile_image']) ?>" alt="" class="w-full h-full object-cover">
                          <?php else: ?>
                            <span class="font-bold text-gray-400 text-xs"><?= View::e(mb_substr($ra['company_name'] ?? $ra['contact_name'] ?? '?', 0, 1)) ?></span>
                          <?php endif; ?>
                        </div>
                        <div class="flex-1 min-w-0">
                          <div class="flex items-center gap-2 mb-0.5">
                            <p class="text-sm font-bold text-gray-900"><?= View::e($ra['company_name'] ?? $ra['contact_name'] ?? '익명') ?></p>
                            <p class="text-xs text-gray-400"><?= View::e(relative_time($r['created_at'] ?? '')) ?></p>
                          </div>
                          <p class="text-sm text-gray-800 leading-relaxed whitespace-pre-wrap"><?= View::e($r['content']) ?></p>
                        </div>
                      </li>
                    <?php endforeach; ?>
                  </ul>
                <?php endif; ?>
              </div>
            </div>
          </li>
        <?php endforeach; ?>
      </ul>
    <?php endif; ?>
  </section>
</div>

<script>
  (function () {
    var btn = document.getElementById('like-btn');
    if (!btn) return;
    btn.addEventListener('click', function () {
      var postId = btn.dataset.postId;
      var csrf = btn.dataset.csrf;
      var fd = new FormData();
      fd.append('_csrf', csrf);
      fetch('/community/' + postId + '/like', { method: 'POST', body: fd })
        .then(function (r) { return r.json(); })
        .then(function (data) {
          if (data.ok) {
            document.getElementById('like-count').textContent = data.count.toLocaleString();
            btn.style.borderColor = data.liked ? '#3617ce' : '#d4d4d8';
            btn.style.background = data.liked ? '#f3f0fd' : '';
          } else {
            alert(data.error || '오류가 발생했습니다.');
          }
        })
        .catch(function () { alert('네트워크 오류'); });
    });
  })();
</script>
