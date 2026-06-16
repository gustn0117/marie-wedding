<?php /** @var array $job */ /** @var array $related */
$isExpired = !empty($job['deadline']) && strtotime($job['deadline']) < time();
$daysLeft = !empty($job['deadline']) ? ceil((strtotime($job['deadline']) - time()) / 86400) : null;
$author = $job['author'] ?? [];
?>

<div class="max-w-[1000px] mx-auto px-4 py-8">
  <nav class="mb-4 text-sm text-gray-500">
    <a href="/jobs" class="hover:text-primary">채용 정보</a>
    <span class="mx-2">›</span>
    <span class="text-gray-900 font-medium truncate"><?= View::e($job['title']) ?></span>
  </nav>

  <div class="grid lg:grid-cols-[1fr_320px] gap-6">
    <main class="space-y-6">
      <section class="rounded-xl border border-gray-200 bg-white p-6 md:p-8">
        <div class="flex flex-wrap items-center gap-2 mb-4">
          <span class="rounded-full bg-primary text-white text-[11px] font-bold px-2 py-1">채용</span>
          <span class="rounded-full bg-gray-100 text-gray-700 text-[11px] font-bold px-2 py-1"><?= View::e(employment_label($job['employment_type'] ?? '')) ?></span>
          <span class="rounded-full bg-gray-100 text-gray-700 text-[11px] font-bold px-2 py-1"><?= View::e(business_label($job['business_type'] ?? '')) ?></span>
          <?php if ($isExpired): ?>
            <span class="rounded-full bg-gray-100 text-gray-500 text-[11px] font-bold px-2 py-1">마감</span>
          <?php elseif ($daysLeft !== null && $daysLeft <= 7): ?>
            <span class="rounded-full bg-red-100 text-red-700 text-[11px] font-bold px-2 py-1">마감 <?= $daysLeft ?>일 전</span>
          <?php endif; ?>
        </div>

        <h1 class="text-2xl md:text-3xl font-bold text-gray-900 leading-tight tracking-tight mb-5"><?= View::e($job['title']) ?></h1>

        <?php if (!empty($author['id'])): ?>
          <a href="/directory/<?= View::e($author['id']) ?>" class="inline-flex items-center gap-3 pb-5 mb-5 border-b border-gray-100">
            <div class="w-10 h-10 rounded-full bg-primary-50 flex items-center justify-center text-primary font-bold">
              <?= View::e(mb_substr($author['company_name'] ?? $author['contact_name'] ?? '?', 0, 1)) ?>
            </div>
            <div>
              <p class="text-sm font-bold text-gray-900"><?= View::e($author['company_name'] ?? $author['contact_name']) ?></p>
              <p class="text-xs text-gray-500"><?= View::e(relative_time($job['created_at'] ?? '')) ?> 등록 · 조회 <?= number_format($job['view_count'] ?? 0) ?></p>
            </div>
          </a>
        <?php endif; ?>

        <div class="grid grid-cols-2 md:grid-cols-4 border border-gray-200 rounded-lg overflow-hidden">
          <div class="px-4 py-3 border-r border-gray-200 last:border-r-0 bg-gray-50">
            <p class="text-[11px] font-bold uppercase tracking-wider text-gray-400 mb-1">근무지역</p>
            <p class="text-sm font-bold text-gray-800"><?= View::e(region_label($job['region'] ?? '')) ?></p>
          </div>
          <div class="px-4 py-3 border-r border-gray-200 bg-gray-50">
            <p class="text-[11px] font-bold uppercase tracking-wider text-gray-400 mb-1">고용형태</p>
            <p class="text-sm font-bold text-gray-800"><?= View::e(employment_label($job['employment_type'] ?? '')) ?></p>
          </div>
          <div class="px-4 py-3 border-r border-gray-200 bg-gray-50">
            <p class="text-[11px] font-bold uppercase tracking-wider text-gray-400 mb-1">급여</p>
            <p class="text-sm font-bold text-gray-900"><?= View::e($job['salary_info'] ?: '면접 후 결정') ?></p>
          </div>
          <div class="px-4 py-3 bg-gray-50">
            <p class="text-[11px] font-bold uppercase tracking-wider text-gray-400 mb-1">마감일</p>
            <p class="text-sm font-bold <?= $isExpired?'text-red-600':'text-gray-800' ?>"><?= View::e($job['deadline']?format_date($job['deadline']):'상시 채용') ?></p>
          </div>
        </div>
      </section>

      <section class="rounded-xl border border-gray-200 bg-white p-6 md:p-8">
        <h2 class="text-lg font-bold text-gray-900 mb-4 pb-3 border-b border-gray-200">상세 내용</h2>
        <div class="text-[15px] text-gray-700 leading-relaxed prose prose-sm max-w-none">
          <?= $job['description'] ?? '' ?>
        </div>
      </section>

      <?php if (!empty($related)): ?>
        <section class="rounded-xl border border-gray-200 bg-white p-6 md:p-8">
          <h2 class="text-lg font-bold text-gray-900 mb-4 pb-3 border-b border-gray-200">이 업체의 다른 공고</h2>
          <ul class="divide-y divide-gray-100">
            <?php foreach ($related as $r): ?>
              <li><a href="/jobs/<?= View::e($r['id']) ?>" class="block py-3 hover:bg-gray-50 -mx-3 px-3 rounded">
                <p class="text-sm font-bold text-gray-900"><?= View::e($r['title']) ?></p>
                <p class="text-xs text-gray-500 mt-1"><?= View::e(employment_label($r['employment_type']??'')) ?> · <?= View::e(region_label($r['region']??'')) ?></p>
              </a></li>
            <?php endforeach; ?>
          </ul>
        </section>
      <?php endif; ?>
    </main>

    <aside class="space-y-4 lg:sticky lg:top-20 lg:self-start">
      <section class="rounded-xl border border-gray-200 bg-white p-5">
        <p class="text-[11px] font-bold uppercase tracking-wider text-gray-400 mb-2">
          <?= $isExpired?'마감된 공고':'진행 중' ?>
        </p>
        <p class="text-base font-bold mb-4 <?= $isExpired?'text-gray-500':'text-gray-900' ?>">
          <?= $job['deadline']?format_date($job['deadline']):'상시 채용' ?>
          <?= !$isExpired && $daysLeft !== null ? " · D-{$daysLeft}" : '' ?>
        </p>
        <?php $me = Auth::profile(); $isOwnerJob = $me && $me['id'] === ($job['author_id'] ?? null); ?>
        <?php if (!Auth::check()): ?>
          <a href="/login" class="btn-primary w-full justify-center py-3">로그인 후 지원</a>
        <?php elseif ($isOwnerJob): ?>
          <div class="rounded-lg bg-gray-50 px-3 py-2 text-xs text-gray-500 text-center">본인 공고입니다.</div>
        <?php else: ?>
          <button type="button" onclick="document.getElementById('apply-modal').hidden=false" class="btn-primary w-full justify-center py-3 <?= $isExpired?'opacity-50 pointer-events-none':'' ?>" <?= $isExpired ? 'disabled' : '' ?>>
            지원하기
          </button>
        <?php endif; ?>
      </section>

      <?php if (!empty($author)): ?>
        <section class="rounded-xl border border-gray-200 bg-white p-5">
          <p class="text-[11px] font-bold uppercase tracking-wider text-gray-400 mb-2">업체 정보</p>
          <a href="/directory/<?= View::e($author['id']) ?>" class="block">
            <p class="text-sm font-bold text-gray-900"><?= View::e($author['company_name'] ?? $author['contact_name']) ?></p>
            <p class="text-xs text-gray-500 mt-1">전체 프로필 보기 →</p>
          </a>
        </section>
      <?php endif; ?>
    </aside>
  </div>
</div>

<?php if (Auth::check() && !$isOwnerJob && !$isExpired): ?>
<div id="apply-modal" hidden class="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onclick="if(event.target===this)this.hidden=true">
  <div class="bg-white rounded-2xl max-w-md w-full p-6">
    <h3 class="text-lg font-bold text-gray-900 mb-4">지원하기</h3>
    <form action="/jobs/<?= View::e($job['id']) ?>/apply" method="POST">
      <input type="hidden" name="_csrf" value="<?= csrf_token() ?>">
      <label class="block text-sm font-semibold text-gray-800 mb-1.5">메시지 (선택)</label>
      <textarea name="message" rows="5" maxlength="2000" placeholder="자기 소개·문의 사항을 자유롭게 작성하세요" class="input resize-none mb-4"></textarea>
      <div class="flex justify-end gap-2">
        <button type="button" onclick="document.getElementById('apply-modal').hidden=true" class="btn-outline">취소</button>
        <button type="submit" class="btn-primary">전송</button>
      </div>
    </form>
  </div>
</div>
<?php endif; ?>
