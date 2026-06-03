<?php /** @var array $profile */ /** @var array $counts */ /** @var array $recentJobs */ /** @var array $recentPosts */
$name = $profile['company_name'] ?: $profile['contact_name'];
?>
<div class="max-w-[1000px] mx-auto px-4 py-8">
  <h1 class="text-3xl font-bold text-gray-900 mb-6 tracking-tight">마이페이지</h1>

  <?php $active = 'index'; require __DIR__ . '/_nav.php'; ?>

  <!-- 프로필 카드 -->
  <section class="rounded-xl border border-gray-200 bg-white p-6 md:p-8 mb-6">
    <div class="flex items-start gap-5">
      <div class="w-16 h-16 md:w-20 md:h-20 bg-gray-50 rounded-lg overflow-hidden flex items-center justify-center shrink-0">
        <?php if (!empty($profile['profile_image'])): ?>
          <img src="<?= View::e(SUPABASE_URL . '/storage/v1/object/public/avatars/' . $profile['profile_image']) ?>" alt="" class="w-full h-full object-contain p-1">
        <?php else: ?>
          <span class="text-2xl font-bold text-gray-300"><?= View::e(mb_substr($name, 0, 1)) ?></span>
        <?php endif; ?>
      </div>
      <div class="flex-1 min-w-0">
        <p class="text-xs text-gray-500 mb-1">안녕하세요,</p>
        <h2 class="text-xl md:text-2xl font-bold text-gray-900 tracking-tight"><?= View::e($name) ?> 님</h2>
        <p class="text-sm text-gray-500 mt-1">
          <?= View::e(business_label($profile['business_type'] ?? '')) ?>
          <?= !empty($profile['region']) ? ' · ' . View::e(region_label($profile['region'])) : '' ?>
        </p>
        <div class="mt-3 flex flex-wrap items-center gap-1.5">
          <?php if (($profile['verification_status'] ?? '') === 'verified'): ?>
            <span class="inline-flex items-center px-2 py-0.5 bg-primary text-white text-[11px] font-bold rounded">✓ 인증 완료</span>
          <?php elseif (($profile['verification_status'] ?? '') === 'pending'): ?>
            <span class="inline-flex items-center px-2 py-0.5 bg-yellow-100 text-yellow-800 text-[11px] font-bold rounded">인증 심사 중</span>
          <?php else: ?>
            <a href="/mypage/verification" class="inline-flex items-center px-2 py-0.5 border border-gray-300 hover:border-primary hover:text-primary text-[11px] font-bold rounded">사업자 인증 신청</a>
          <?php endif; ?>
          <?php if (!empty($profile['phone_verified'])): ?>
            <span class="inline-flex items-center px-2 py-0.5 border border-gray-300 text-gray-700 text-[11px] font-bold rounded">실명 확인</span>
          <?php endif; ?>
        </div>
      </div>
      <a href="/mypage/profile" class="shrink-0 btn-outline text-xs">프로필 수정</a>
    </div>
  </section>

  <!-- 활동 요약 -->
  <section class="grid grid-cols-3 gap-3 mb-6">
    <a href="/mypage/jobs" class="rounded-xl border border-gray-200 bg-white p-5 hover:shadow-md transition-all">
      <p class="text-xs text-gray-500 mb-1">내 공고</p>
      <p class="text-2xl font-bold text-gray-900 tabular-nums"><?= number_format($counts['jobs']) ?></p>
    </a>
    <a href="/mypage/posts" class="rounded-xl border border-gray-200 bg-white p-5 hover:shadow-md transition-all">
      <p class="text-xs text-gray-500 mb-1">내 글</p>
      <p class="text-2xl font-bold text-gray-900 tabular-nums"><?= number_format($counts['posts']) ?></p>
    </a>
    <a href="/mypage/applications" class="rounded-xl border border-gray-200 bg-white p-5 hover:shadow-md transition-all">
      <p class="text-xs text-gray-500 mb-1">지원 내역</p>
      <p class="text-2xl font-bold text-gray-900 tabular-nums"><?= number_format($counts['applications']) ?></p>
    </a>
  </section>

  <!-- 최근 활동 -->
  <div class="grid md:grid-cols-2 gap-4">
    <section class="rounded-xl border border-gray-200 bg-white p-6">
      <div class="flex items-end justify-between mb-3">
        <h3 class="text-lg font-bold text-gray-900">최근 내 공고</h3>
        <a href="/mypage/jobs" class="text-xs text-gray-500 hover:text-primary">더보기 →</a>
      </div>
      <?php if (empty($recentJobs)): ?>
        <p class="py-6 text-center text-sm text-gray-400">아직 공고가 없습니다.</p>
      <?php else: ?>
        <ul class="divide-y divide-gray-100">
          <?php foreach ($recentJobs as $j): ?>
            <li><a href="/jobs/<?= View::e($j['id']) ?>" class="block py-3 hover:bg-gray-50 -mx-3 px-3 rounded">
              <p class="text-sm font-bold text-gray-900 truncate"><?= View::e($j['title']) ?></p>
              <p class="text-xs text-gray-500 mt-0.5"><?= View::e(relative_time($j['created_at'] ?? '')) ?> · 조회 <?= number_format($j['view_count'] ?? 0) ?></p>
            </a></li>
          <?php endforeach; ?>
        </ul>
      <?php endif; ?>
    </section>

    <section class="rounded-xl border border-gray-200 bg-white p-6">
      <div class="flex items-end justify-between mb-3">
        <h3 class="text-lg font-bold text-gray-900">최근 내 글</h3>
        <a href="/mypage/posts" class="text-xs text-gray-500 hover:text-primary">더보기 →</a>
      </div>
      <?php if (empty($recentPosts)): ?>
        <p class="py-6 text-center text-sm text-gray-400">아직 작성한 글이 없습니다.</p>
      <?php else: ?>
        <ul class="divide-y divide-gray-100">
          <?php foreach ($recentPosts as $p): ?>
            <li><a href="/community/<?= View::e($p['id']) ?>" class="block py-3 hover:bg-gray-50 -mx-3 px-3 rounded">
              <p class="text-sm font-bold text-gray-900 truncate"><?= View::e($p['title']) ?></p>
              <p class="text-xs text-gray-500 mt-0.5"><?= View::e(relative_time($p['created_at'] ?? '')) ?> · 조회 <?= number_format($p['view_count'] ?? 0) ?> · 댓글 <?= number_format($p['comment_count'] ?? 0) ?></p>
            </a></li>
          <?php endforeach; ?>
        </ul>
      <?php endif; ?>
    </section>
  </div>
</div>
