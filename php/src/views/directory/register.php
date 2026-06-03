<?php /** @var array $profile */ ?>
<div class="max-w-3xl mx-auto px-4 py-10">
  <nav class="text-sm text-gray-500 mb-4">
    <a href="/mypage" class="hover:text-primary">마이페이지</a>
    <span class="mx-2">›</span>
    <span class="text-gray-900 font-medium">업체 등록</span>
  </nav>

  <h1 class="text-3xl font-bold text-gray-900 mb-2 tracking-tight">업체 디렉토리 등록</h1>
  <p class="text-sm text-gray-500 mb-8">디렉토리에 공개하면 다른 사용자가 업체를 찾을 수 있습니다.</p>

  <form action="/mypage/directory" method="POST" class="space-y-5">
    <input type="hidden" name="_csrf" value="<?= csrf_token() ?>">

    <div class="rounded-xl border border-gray-200 bg-white p-5">
      <label class="flex items-center gap-3 text-sm">
        <input type="checkbox" name="is_directory_listed" value="1" <?= !empty($profile['is_directory_listed']) ? 'checked' : '' ?> class="w-4 h-4">
        <span class="font-bold text-gray-900">디렉토리에 공개하기</span>
      </label>
      <p class="text-xs text-gray-500 mt-2">체크 해제 시 디렉토리 리스트에서 숨겨집니다.</p>
    </div>

    <div class="rounded-xl border border-gray-200 bg-white p-5 grid sm:grid-cols-2 gap-4">
      <div>
        <label class="block text-sm font-semibold text-gray-800 mb-1.5">업체명</label>
        <input type="text" name="company_name" value="<?= View::e($profile['company_name'] ?? '') ?>" class="input">
      </div>
      <div>
        <label class="block text-sm font-semibold text-gray-800 mb-1.5">지역 *</label>
        <select name="region" required class="input">
          <?php foreach (['seoul'=>'서울','gyeonggi'=>'경기','incheon'=>'인천','busan'=>'부산','daegu'=>'대구','daejeon'=>'대전','gwangju'=>'광주','ulsan'=>'울산','sejong'=>'세종','gangwon'=>'강원','chungbuk'=>'충북','chungnam'=>'충남','jeonbuk'=>'전북','jeonnam'=>'전남','gyeongbuk'=>'경북','gyeongnam'=>'경남','jeju'=>'제주'] as $k=>$v): ?>
            <option value="<?= $k ?>" <?= ($profile['region']??'')===$k?'selected':'' ?>><?= $v ?></option>
          <?php endforeach; ?>
        </select>
      </div>
    </div>

    <div class="rounded-xl border border-gray-200 bg-white p-5">
      <label class="block text-sm font-semibold text-gray-800 mb-1.5">업종</label>
      <select name="business_type" class="input">
        <option value="">선택</option>
        <?php foreach (['venue'=>'예식장','dress'=>'드레스샵','studio'=>'스튜디오','makeup'=>'메이크업','planner'=>'웨딩플래너','assistant'=>'예식 도우미','mc'=>'사회자','designer'=>'디자이너','singer'=>'축가','other'=>'기타'] as $k=>$v): ?>
          <option value="<?= $k ?>" <?= ($profile['business_type']??'')===$k?'selected':'' ?>><?= $v ?></option>
        <?php endforeach; ?>
      </select>
    </div>

    <div class="rounded-xl border border-gray-200 bg-white p-5">
      <label class="block text-sm font-semibold text-gray-800 mb-1.5">업체 소개</label>
      <textarea name="bio" rows="6" placeholder="업체 소개·제공 서비스·실적 등" class="input resize-none"><?= View::e(strip_tags($profile['bio'] ?? '')) ?></textarea>
    </div>

    <div class="rounded-xl border border-gray-200 bg-white p-5 grid sm:grid-cols-2 gap-4">
      <div>
        <label class="block text-sm font-semibold text-gray-800 mb-1.5">웹사이트</label>
        <input type="text" name="website" value="<?= View::e($profile['website'] ?? '') ?>" placeholder="예) https://your-site.com" class="input">
      </div>
      <div>
        <label class="block text-sm font-semibold text-gray-800 mb-1.5">주소</label>
        <input type="text" name="address" value="<?= View::e($profile['address'] ?? '') ?>" class="input">
      </div>
      <div>
        <label class="block text-sm font-semibold text-gray-800 mb-1.5">규모 (명)</label>
        <input type="text" name="company_size" value="<?= View::e($profile['company_size'] ?? '') ?>" placeholder="예) 10 또는 private" class="input">
      </div>
      <div>
        <label class="block text-sm font-semibold text-gray-800 mb-1.5">설립 연도</label>
        <input type="text" name="established_year" value="<?= View::e($profile['established_year'] ?? '') ?>" placeholder="예) 2020" class="input">
      </div>
    </div>

    <div class="flex justify-end gap-2 pt-4 border-t border-gray-200">
      <a href="/mypage" class="btn-outline">취소</a>
      <button type="submit" class="btn-primary">저장</button>
    </div>
  </form>
</div>
