<?php /** @var array $profile */ /** @var array $jobs */ /** @var array $portfolios */
$name = $profile['company_name'] ?: $profile['contact_name'];
$isVerified = ($profile['verification_status'] ?? '') === 'verified';
$isPremium = ($profile['premium_tier'] ?? 'free') !== 'free';
$me = Auth::profile();
$isOwner = $me && $me['id'] === $profile['id'];
?>

<div class="max-w-[1000px] mx-auto px-4 py-8">
  <nav class="mb-4 text-sm text-gray-500">
    <a href="/directory" class="hover:text-primary">업체 디렉토리</a>
    <span class="mx-2">›</span>
    <span class="text-gray-900 font-medium truncate"><?= View::e($name) ?></span>
  </nav>

  <!-- Hero -->
  <section class="rounded-xl border border-gray-200 bg-white p-6 md:p-8 mb-6">
    <div class="flex items-start gap-5 mb-5">
      <div class="w-20 h-20 md:w-24 md:h-24 bg-gray-50 rounded-lg overflow-hidden flex items-center justify-center shrink-0">
        <?php if (!empty($profile['profile_image'])): ?>
          <img src="<?= View::e(SUPABASE_URL . '/storage/v1/object/public/avatars/' . $profile['profile_image']) ?>" alt="<?= View::e($name) ?>" class="w-full h-full object-contain p-1">
        <?php else: ?>
          <span class="text-3xl font-bold text-gray-300"><?= View::e(mb_substr($name, 0, 1)) ?></span>
        <?php endif; ?>
      </div>

      <div class="flex-1 min-w-0">
        <div class="flex items-start justify-between gap-3 mb-2">
          <h1 class="text-2xl md:text-3xl font-bold text-gray-900 tracking-tight break-words"><?= View::e($name) ?></h1>
          <?php if ($isOwner): ?>
            <a href="/mypage/directory" class="shrink-0 btn-outline text-xs">수정하기</a>
          <?php endif; ?>
        </div>

        <div class="flex flex-wrap items-center gap-1.5">
          <?php if ($isPremium): ?>
            <span class="inline-flex items-center px-2 py-0.5 bg-primary text-white text-[11px] font-bold rounded">PREMIUM</span>
          <?php endif; ?>
          <?php if ($isVerified): ?>
            <span class="inline-flex items-center px-2 py-0.5 bg-primary text-white text-[11px] font-bold rounded">✓ 인증</span>
          <?php elseif (!empty($profile['phone_verified'])): ?>
            <span class="inline-flex items-center px-2 py-0.5 border border-gray-300 text-gray-700 text-[11px] font-bold rounded">실명 확인</span>
          <?php endif; ?>
          <?php if (!empty($profile['business_type'])):
            foreach (explode(',', $profile['business_type']) as $bt): $bt = trim($bt); if(!$bt) continue; ?>
              <span class="inline-flex items-center px-2 py-0.5 bg-primary-50 text-primary text-[11px] font-bold rounded"><?= View::e(business_label($bt)) ?></span>
            <?php endforeach;
          endif; ?>
          <span class="inline-flex items-center px-2 py-0.5 bg-gray-100 text-gray-700 text-[11px] font-bold rounded"><?= View::e(region_label($profile['region'] ?? '')) ?></span>
        </div>
      </div>
    </div>

    <!-- Quick contact -->
    <div class="flex flex-wrap gap-2 mb-6 pb-6 border-b border-gray-100">
      <?php if (!empty($profile['phone'])): ?>
        <a href="tel:<?= View::e($profile['phone']) ?>" class="btn-primary text-sm">📞 <?= View::e($profile['phone']) ?></a>
      <?php endif; ?>
      <?php if (!empty($profile['website'])): $w = $profile['website']; if(!preg_match('/^https?:/', $w)) $w = 'https://'.$w; ?>
        <a href="<?= View::e($w) ?>" target="_blank" rel="noopener" class="btn-outline text-sm">🌐 웹사이트</a>
      <?php endif; ?>
    </div>

    <!-- Info grid -->
    <div class="grid grid-cols-2 md:grid-cols-4 border border-gray-200 rounded-lg overflow-hidden text-sm">
      <?php
        $infoCells = [
          ['담당자', $profile['contact_name'] ?? '-'],
          ['규모', !empty($profile['company_size']) ? ($profile['company_size']==='private'?'비공개':$profile['company_size'].'명') : '-'],
          ['설립', !empty($profile['established_year']) ? $profile['established_year'].'년' : '-'],
          ['등록일', format_date($profile['created_at'] ?? null) ?: '-'],
        ];
        foreach ($infoCells as [$l, $v]):
      ?>
        <div class="px-4 py-3 border-r border-gray-200 last:border-r-0 bg-gray-50">
          <p class="text-[11px] font-bold text-gray-400 mb-0.5"><?= $l ?></p>
          <p class="text-sm font-bold text-gray-900 truncate"><?= View::e($v) ?></p>
        </div>
      <?php endforeach; ?>
    </div>
  </section>

  <!-- Trust card -->
  <?php if (($profile['completed_deals_count'] ?? 0) > 0 || ($profile['response_rate'] ?? 0) > 0 || $isVerified): ?>
    <section class="rounded-xl border border-gray-200 bg-white p-6 md:p-8 mb-6">
      <h2 class="text-lg font-bold text-gray-900 mb-4 pb-3 border-b border-gray-200">신뢰 지표</h2>
      <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div>
          <p class="text-xs text-gray-500 mb-1">인증 상태</p>
          <p class="text-xl font-bold text-gray-900"><?= $isVerified ? '인증 완료' : (!empty($profile['phone_verified']) ? '실명 확인' : '미인증') ?></p>
        </div>
        <div>
          <p class="text-xs text-gray-500 mb-1">거래 완료</p>
          <p class="text-xl font-bold text-gray-900 tabular-nums"><?= number_format($profile['completed_deals_count'] ?? 0) ?>건</p>
        </div>
        <div>
          <p class="text-xs text-gray-500 mb-1">응답률</p>
          <p class="text-xl font-bold text-gray-900 tabular-nums"><?= ($profile['response_rate'] ?? 0) > 0 ? round($profile['response_rate']).'%' : '-' ?></p>
        </div>
        <div>
          <p class="text-xs text-gray-500 mb-1">평균 응답</p>
          <p class="text-xl font-bold text-gray-900 tabular-nums">
            <?php $m = $profile['avg_response_minutes'] ?? null;
            if (!$m) echo '-';
            elseif ($m < 60) echo $m.'분';
            elseif ($m < 1440) echo round($m/60).'시간';
            else echo round($m/1440).'일'; ?>
          </p>
        </div>
      </div>
    </section>
  <?php endif; ?>

  <!-- Bio -->
  <?php if (!empty($profile['bio'])): ?>
    <section class="rounded-xl border border-gray-200 bg-white p-6 md:p-8 mb-6">
      <h2 class="text-lg font-bold text-gray-900 mb-4 pb-3 border-b border-gray-200">소개</h2>
      <div class="text-[15px] text-gray-700 leading-relaxed"><?= $profile['bio'] ?></div>
    </section>
  <?php endif; ?>

  <!-- Portfolios -->
  <?php if (!empty($portfolios)): ?>
    <section class="rounded-xl border border-gray-200 bg-white p-6 md:p-8 mb-6">
      <h2 class="text-lg font-bold text-gray-900 mb-4 pb-3 border-b border-gray-200">
        포트폴리오 <span class="text-sm text-gray-400 font-normal ml-1"><?= count($portfolios) ?></span>
      </h2>
      <div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
        <?php foreach ($portfolios as $pf): $cover = $pf['cover_image'] ?? ($pf['images'][0] ?? null); ?>
          <div class="rounded-lg border border-gray-200 overflow-hidden">
            <div class="aspect-[4/3] bg-gray-50 flex items-center justify-center">
              <?php if ($cover): ?>
                <img src="<?= View::e(SUPABASE_URL . '/storage/v1/object/public/portfolios/' . $cover) ?>" alt="" class="w-full h-full object-cover">
              <?php else: ?>
                <span class="text-xs text-gray-400">이미지 없음</span>
              <?php endif; ?>
            </div>
            <div class="p-3">
              <p class="text-sm font-bold text-gray-900 line-clamp-1"><?= View::e($pf['title']) ?></p>
              <?php if (!empty($pf['event_date']) || !empty($pf['role'])): ?>
                <p class="text-xs text-gray-500 mt-0.5 truncate">
                  <?= !empty($pf['event_date']) ? format_date($pf['event_date']) : '' ?>
                  <?= !empty($pf['event_date']) && !empty($pf['role']) ? ' · ' : '' ?>
                  <?= View::e($pf['role'] ?? '') ?>
                </p>
              <?php endif; ?>
            </div>
          </div>
        <?php endforeach; ?>
      </div>
    </section>
  <?php endif; ?>

  <!-- Jobs -->
  <section class="rounded-xl border border-gray-200 bg-white p-6 md:p-8">
    <h2 class="text-lg font-bold text-gray-900 mb-4 pb-3 border-b border-gray-200">
      채용 공고 <span class="text-sm text-gray-400 font-normal ml-1"><?= count($jobs) ?></span>
    </h2>
    <?php if (empty($jobs)): ?>
      <p class="text-sm text-gray-400 py-6 text-center">등록된 공고가 없습니다.</p>
    <?php else: ?>
      <ul class="divide-y divide-gray-100">
        <?php foreach ($jobs as $j): ?>
          <li><a href="/jobs/<?= View::e($j['id']) ?>" class="flex items-center justify-between gap-3 py-3 -mx-3 px-3 rounded hover:bg-gray-50">
            <div class="min-w-0 flex-1">
              <p class="text-sm font-bold text-gray-900 truncate"><?= View::e($j['title']) ?></p>
              <p class="text-xs text-gray-500 mt-0.5"><?= View::e(employment_label($j['employment_type']??'')) ?> · <?= View::e(region_label($j['region']??'')) ?></p>
            </div>
            <span class="text-xs text-gray-400 shrink-0"><?= View::e(format_date($j['created_at']??'')) ?></span>
          </a></li>
        <?php endforeach; ?>
      </ul>
    <?php endif; ?>
  </section>
</div>
