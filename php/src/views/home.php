<?php /** @var array $jobs */ /** @var array $profiles */ /** @var array $posts */ /** @var array $counts */ ?>

<section class="bg-gradient-to-b from-gray-50 to-white pt-16 pb-12 sm:pt-20 sm:pb-16">
  <div class="max-w-[1200px] mx-auto px-4">
    <div class="flex flex-col items-center text-center gap-6 max-w-3xl mx-auto">
      <span class="text-[12px] font-semibold text-primary">웨딩 산업 B2B 네트워크</span>
      <h1 class="text-[32px] sm:text-[44px] font-bold leading-[1.15] text-gray-900 tracking-tight">
        웨딩 업계 채용과<br>파트너 연결의 가장 빠른 길
      </h1>
      <p class="text-[16px] sm:text-[17px] leading-relaxed text-gray-600 max-w-xl">
        공고 탐색부터 지원 관리, 업체 디렉토리, 현장 커뮤니티까지<br class="hidden sm:block">
        한 화면에서 매끄럽게 이어갑니다.
      </p>
      <form action="/search" method="GET" class="flex h-14 sm:h-16 overflow-hidden rounded-2xl border-2 border-gray-200 bg-white shadow-sm focus-within:border-primary focus-within:ring-4 focus-within:ring-primary-100 w-full">
        <div class="flex items-center pl-5 sm:pl-6 text-gray-400">
          <svg class="w-5 h-5 sm:w-6 sm:h-6" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z"/></svg>
        </div>
        <input type="text" name="q" placeholder="직무, 업체명, 지역으로 검색" class="min-w-0 flex-1 px-4 text-[15px] sm:text-[16px] font-medium outline-none placeholder:text-gray-400" />
        <button type="submit" class="bg-primary px-6 sm:px-8 text-sm sm:text-base font-semibold text-white hover:bg-primary-dark transition-colors">검색</button>
      </form>
      <div class="flex flex-wrap items-center justify-center gap-1.5 text-sm">
        <span class="text-gray-500 mr-1">인기</span>
        <?php foreach (['웨딩플래너', '예식장 매니저', '드레스 피팅', '주말 알바', '스튜디오 보정'] as $tag): ?>
          <a href="/jobs?search=<?= urlencode($tag) ?>" class="rounded-full bg-white border border-gray-200 px-3 py-1.5 text-gray-700 text-[13px] hover:border-gray-400 hover:text-gray-900 transition-colors"><?= View::e($tag) ?></a>
        <?php endforeach; ?>
      </div>
    </div>

    <div class="mt-12 grid grid-cols-3 gap-4 sm:gap-6 max-w-3xl mx-auto text-center">
      <div>
        <p class="text-[12px] sm:text-[13px] text-gray-500 mb-1">인증 업체</p>
        <p class="text-[24px] sm:text-[28px] font-bold text-gray-900 tabular-nums tracking-tight"><?= number_format($counts['verified']) ?><span class="text-[14px] sm:text-[16px] font-semibold text-gray-500 ml-1">곳</span></p>
      </div>
      <div>
        <p class="text-[12px] sm:text-[13px] text-gray-500 mb-1">최근 30일 신규 공고</p>
        <p class="text-[24px] sm:text-[28px] font-bold text-gray-900 tabular-nums tracking-tight"><?= number_format($counts['recentJobs']) ?><span class="text-[14px] sm:text-[16px] font-semibold text-gray-500 ml-1">건</span></p>
      </div>
      <div>
        <p class="text-[12px] sm:text-[13px] text-gray-500 mb-1">활성 파트너</p>
        <p class="text-[24px] sm:text-[28px] font-bold text-gray-900 tabular-nums tracking-tight"><?= number_format($counts['profiles']) ?><span class="text-[14px] sm:text-[16px] font-semibold text-gray-500 ml-1">곳</span></p>
      </div>
    </div>
  </div>
</section>

<div class="max-w-[1200px] mx-auto px-4 space-y-12 sm:space-y-16">

  <!-- Quick actions -->
  <section>
    <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
      <?php $quick = [
        ['/jobs', '채용 탐색', '지역·업종별 공고를 한눈에', '🔍'],
        ['/jobs?type=matching', '파트너 섭외', '협업 가능한 업체 찾기', '🤝'],
        ['/directory', '업체 디렉토리', '검증된 프로필 모음', '🏢'],
        ['/community', '커뮤니티', '현장 노하우 공유', '💬'],
      ]; foreach ($quick as $q): ?>
        <a href="<?= $q[0] ?>" class="card flex flex-col items-start gap-3">
          <span class="text-3xl"><?= $q[3] ?></span>
          <div>
            <p class="text-[16px] font-bold text-gray-900"><?= $q[1] ?></p>
            <p class="mt-1 text-[13px] text-gray-500 leading-relaxed"><?= $q[2] ?></p>
          </div>
        </a>
      <?php endforeach; ?>
    </div>
  </section>

  <!-- Featured jobs -->
  <section>
    <div class="flex items-end justify-between mb-5 sm:mb-6">
      <div>
        <h2 class="text-[20px] sm:text-[24px] font-bold text-gray-900 tracking-tight">최신 채용·섭외 공고</h2>
        <p class="mt-1 text-[14px] text-gray-500">최근 등록된 공고를 만나보세요</p>
      </div>
      <a href="/jobs" class="text-[13px] font-semibold text-gray-500 hover:text-primary">전체보기 →</a>
    </div>
    <?php if (empty($jobs)): ?>
      <div class="rounded-xl border-2 border-dashed border-gray-200 bg-white p-10 text-center">
        <p class="text-sm text-gray-500 mb-4">아직 등록된 공고가 없습니다.</p>
        <a href="/jobs/new" class="btn-primary inline-flex">공고 등록</a>
      </div>
    <?php else: ?>
      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <?php foreach ($jobs as $job): ?>
          <a href="/jobs/<?= View::e($job['id']) ?>" class="card flex flex-col gap-3">
            <div class="flex items-start justify-between gap-2">
              <p class="text-[13px] font-semibold text-gray-500 truncate"><?= View::e($job['author']['company_name'] ?? $job['author']['contact_name'] ?? '업체명 미등록') ?></p>
              <?php if (!empty($job['is_promoted'])): ?><span class="rounded-full bg-primary-50 text-primary text-[11px] font-semibold px-2 py-0.5 shrink-0">추천</span><?php endif; ?>
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
    <?php endif; ?>
  </section>

  <!-- Directory -->
  <?php if (!empty($profiles)): ?>
  <section>
    <div class="flex items-end justify-between mb-5 sm:mb-6">
      <div>
        <h2 class="text-[20px] sm:text-[24px] font-bold text-gray-900 tracking-tight">추천 파트너 업체</h2>
        <p class="mt-1 text-[14px] text-gray-500">검증된 업체 프로필을 확인하세요</p>
      </div>
      <a href="/directory" class="text-[13px] font-semibold text-gray-500 hover:text-primary">전체보기 →</a>
    </div>
    <div class="grid grid-cols-2 lg:grid-cols-4 gap-4">
      <?php foreach ($profiles as $p): $name = $p['company_name'] ?: $p['contact_name']; ?>
        <a href="/directory/<?= View::e($p['id']) ?>" class="rounded-xl border border-gray-200 bg-white overflow-hidden hover:shadow-md hover:-translate-y-0.5 transition-all">
          <div class="aspect-[4/3] bg-gray-50 flex items-center justify-center">
            <?php if (!empty($p['profile_image'])): ?>
              <img src="<?= View::e(SUPABASE_URL . '/storage/v1/object/public/avatars/' . $p['profile_image']) ?>" alt="" class="w-full h-full object-contain p-4">
            <?php else: ?>
              <span class="text-3xl font-bold text-gray-300"><?= View::e(mb_substr($name, 0, 1)) ?></span>
            <?php endif; ?>
          </div>
          <div class="p-4">
            <p class="text-[15px] font-bold text-gray-900 truncate"><?= View::e($name) ?></p>
            <p class="text-[12px] text-gray-500 mt-1 truncate"><?= View::e(business_label($p['business_type'] ?? '')) ?> · <?= View::e(region_label($p['region'] ?? '')) ?></p>
          </div>
        </a>
      <?php endforeach; ?>
    </div>
  </section>
  <?php endif; ?>

</div>
