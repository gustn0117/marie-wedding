<?php /** @var array $profiles */ /** @var array $filters */ /** @var int $page */ ?>

<div class="max-w-[1200px] mx-auto px-4 py-10">
  <div class="flex flex-wrap items-end justify-between gap-3 mb-8">
    <div>
      <h1 class="text-3xl font-bold text-gray-900 tracking-tight">업체 디렉토리</h1>
      <p class="mt-2 text-sm text-gray-500">웨딩 업계 파트너 업체 <span class="font-bold text-gray-900"><?= count($profiles) ?></span>곳</p>
    </div>
    <?php if (Auth::check()): ?>
      <a href="/mypage/directory" class="btn-outline text-xs">내 업체 등록</a>
    <?php endif; ?>
  </div>

  <form action="/directory" method="GET" class="rounded-xl border border-gray-200 bg-white p-4 mb-6">
    <div class="flex flex-wrap gap-2 items-center">
      <input type="text" name="search" value="<?= View::e($filters['search'] ?? '') ?>" placeholder="업체명 검색" class="input flex-1 min-w-[200px]">
      <select name="region" class="input w-auto">
        <option value="">지역 전체</option>
        <?php foreach (['seoul'=>'서울','gyeonggi'=>'경기','incheon'=>'인천','busan'=>'부산','daegu'=>'대구','jeju'=>'제주'] as $k=>$v): ?>
          <option value="<?= $k ?>" <?= ($filters['region']??'')===$k?'selected':'' ?>><?= $v ?></option>
        <?php endforeach; ?>
      </select>
      <select name="businessType" class="input w-auto">
        <option value="">업종 전체</option>
        <?php foreach (['venue'=>'예식장','dress'=>'드레스샵','studio'=>'스튜디오','makeup'=>'메이크업','planner'=>'웨딩플래너','assistant'=>'예식 도우미','mc'=>'사회자','designer'=>'디자이너','singer'=>'축가'] as $k=>$v): ?>
          <option value="<?= $k ?>" <?= ($filters['businessType']??'')===$k?'selected':'' ?>><?= $v ?></option>
        <?php endforeach; ?>
      </select>
      <button type="submit" class="btn-primary px-6">검색</button>
    </div>
  </form>

  <?php if (empty($profiles)): ?>
    <div class="rounded-xl border-2 border-dashed border-gray-200 bg-white p-16 text-center">
      <p class="text-sm text-gray-500 mb-4">등록된 업체가 없습니다.</p>
      <a href="/directory" class="btn-outline">필터 초기화</a>
    </div>
  <?php else: ?>
    <div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
      <?php foreach ($profiles as $p): $name = $p['company_name'] ?: $p['contact_name']; $verified = ($p['verification_status'] ?? '') === 'verified'; $premium = ($p['premium_tier'] ?? 'free') !== 'free'; ?>
        <a href="/directory/<?= View::e($p['id']) ?>" class="rounded-xl border border-gray-200 bg-white overflow-hidden hover:shadow-md hover:-translate-y-0.5 transition-all relative">
          <?php if ($premium): ?>
            <span class="absolute top-2 left-2 z-10 inline-flex items-center px-1.5 py-0.5 bg-primary text-white text-[10px] font-bold rounded">PREMIUM</span>
          <?php endif; ?>
          <?php if ($verified): ?>
            <span class="absolute top-2 right-2 z-10 inline-flex items-center px-1.5 py-0.5 bg-primary text-white text-[10px] font-bold rounded">✓ 인증</span>
          <?php endif; ?>
          <div class="aspect-[4/3] bg-gray-50 flex items-center justify-center overflow-hidden">
            <?php if (!empty($p['profile_image'])): ?>
              <img src="<?= View::e(SUPABASE_URL . '/storage/v1/object/public/avatars/' . $p['profile_image']) ?>" alt="" class="w-full h-full object-contain p-4">
            <?php else: ?>
              <span class="text-3xl font-bold text-gray-300"><?= View::e(mb_substr($name, 0, 1)) ?></span>
            <?php endif; ?>
          </div>
          <div class="p-4">
            <p class="text-[15px] font-bold text-gray-900 truncate"><?= View::e($name) ?></p>
            <p class="text-[12px] text-gray-500 mt-1 truncate">
              <?= View::e(business_label($p['business_type'] ?? '')) ?> · <?= View::e(region_label($p['region'] ?? '')) ?>
            </p>
            <?php if (!empty($p['bio'])): $bio = trim(preg_replace('/\s+/', ' ', strip_tags($p['bio']))); ?>
              <p class="text-[12px] text-gray-500 mt-2 line-clamp-2 leading-relaxed"><?= View::e(mb_substr($bio, 0, 80)) ?></p>
            <?php endif; ?>
            <?php if (($p['completed_deals_count'] ?? 0) > 0 || ($p['response_rate'] ?? 0) > 0): ?>
              <div class="mt-3 pt-3 border-t border-gray-100 flex items-center gap-3 text-[11px] text-gray-500">
                <?php if (($p['completed_deals_count'] ?? 0) > 0): ?>
                  <span>거래 <span class="font-bold text-gray-700"><?= number_format($p['completed_deals_count']) ?></span>건</span>
                <?php endif; ?>
                <?php if (($p['response_rate'] ?? 0) > 0): ?>
                  <span>응답 <span class="font-bold text-gray-700"><?= round($p['response_rate']) ?>%</span></span>
                <?php endif; ?>
              </div>
            <?php endif; ?>
          </div>
        </a>
      <?php endforeach; ?>
    </div>

    <?php if (count($profiles) === 20): ?>
      <div class="mt-8 flex justify-center gap-2">
        <?php $qs = $_GET; if ($page > 1): $qs['page'] = $page - 1; ?>
          <a href="?<?= http_build_query($qs) ?>" class="btn-outline">이전</a>
        <?php endif; $qs['page'] = $page + 1; ?>
        <a href="?<?= http_build_query($qs) ?>" class="btn-primary">다음</a>
      </div>
    <?php endif; ?>
  <?php endif; ?>
</div>
