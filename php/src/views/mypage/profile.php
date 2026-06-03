<?php /** @var array $profile */ ?>
<div class="max-w-[1000px] mx-auto px-4 py-8">
  <h1 class="text-3xl font-bold text-gray-900 mb-6 tracking-tight">프로필 수정</h1>
  <?php $active = 'profile'; require __DIR__ . '/_nav.php'; ?>

  <form action="/mypage/profile" method="POST" class="space-y-5">
    <input type="hidden" name="_csrf" value="<?= csrf_token() ?>">

    <div class="rounded-xl border border-gray-200 bg-white p-5 md:p-6 grid sm:grid-cols-2 gap-4">
      <div>
        <label class="block text-sm font-semibold text-gray-800 mb-1.5">담당자 이름 *</label>
        <input type="text" name="contact_name" required value="<?= View::e($profile['contact_name'] ?? '') ?>" class="input">
      </div>
      <div>
        <label class="block text-sm font-semibold text-gray-800 mb-1.5">업체명</label>
        <input type="text" name="company_name" value="<?= View::e($profile['company_name'] ?? '') ?>" class="input">
      </div>
      <div>
        <label class="block text-sm font-semibold text-gray-800 mb-1.5">업종</label>
        <select name="business_type" class="input">
          <option value="">선택</option>
          <?php foreach (['venue'=>'예식장','dress'=>'드레스샵','studio'=>'스튜디오','makeup'=>'메이크업','planner'=>'웨딩플래너','assistant'=>'예식 도우미','mc'=>'사회자','designer'=>'디자이너','singer'=>'축가','other'=>'기타'] as $k=>$v): ?>
            <option value="<?= $k ?>" <?= ($profile['business_type']??'')===$k?'selected':'' ?>><?= $v ?></option>
          <?php endforeach; ?>
        </select>
      </div>
      <div>
        <label class="block text-sm font-semibold text-gray-800 mb-1.5">지역 *</label>
        <select name="region" required class="input">
          <?php foreach (['seoul'=>'서울','gyeonggi'=>'경기','incheon'=>'인천','busan'=>'부산','daegu'=>'대구','daejeon'=>'대전','gwangju'=>'광주','ulsan'=>'울산','sejong'=>'세종','gangwon'=>'강원','chungbuk'=>'충북','chungnam'=>'충남','jeonbuk'=>'전북','jeonnam'=>'전남','gyeongbuk'=>'경북','gyeongnam'=>'경남','jeju'=>'제주'] as $k=>$v): ?>
            <option value="<?= $k ?>" <?= ($profile['region']??'')===$k?'selected':'' ?>><?= $v ?></option>
          <?php endforeach; ?>
        </select>
      </div>
      <div>
        <label class="block text-sm font-semibold text-gray-800 mb-1.5">연락처</label>
        <input type="tel" name="phone" value="<?= View::e($profile['phone'] ?? '') ?>" placeholder="01012345678" class="input">
      </div>
    </div>

    <div class="rounded-xl border border-gray-200 bg-white p-5 md:p-6">
      <label class="block text-sm font-semibold text-gray-800 mb-1.5">자기 소개</label>
      <textarea name="bio" rows="5" class="input resize-none"><?= View::e(strip_tags($profile['bio'] ?? '')) ?></textarea>
    </div>

    <div class="flex justify-end gap-2 pt-2">
      <a href="/mypage" class="btn-outline">취소</a>
      <button type="submit" class="btn-primary">저장</button>
    </div>
  </form>
</div>
