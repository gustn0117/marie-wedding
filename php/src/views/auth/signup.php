<div class="max-w-xl mx-auto px-4 py-16">
  <h1 class="text-3xl font-bold text-gray-900 mb-2 tracking-tight">회원가입</h1>
  <p class="text-sm text-gray-500 mb-8">웨딩 업계 종사자를 위한 B2B 네트워크에 가입하세요.</p>

  <form action="/signup" method="POST" class="space-y-4">
    <input type="hidden" name="_csrf" value="<?= csrf_token() ?>">

    <div class="grid sm:grid-cols-2 gap-4">
      <div>
        <label class="block text-sm font-semibold text-gray-800 mb-1.5">이메일 *</label>
        <input type="email" name="email" required autocomplete="email" class="input">
      </div>
      <div>
        <label class="block text-sm font-semibold text-gray-800 mb-1.5">비밀번호 (8자+) *</label>
        <input type="password" name="password" required minlength="8" autocomplete="new-password" class="input">
      </div>
    </div>

    <div class="grid sm:grid-cols-2 gap-4">
      <div>
        <label class="block text-sm font-semibold text-gray-800 mb-1.5">담당자 이름 *</label>
        <input type="text" name="contact_name" required class="input">
      </div>
      <div>
        <label class="block text-sm font-semibold text-gray-800 mb-1.5">업체명</label>
        <input type="text" name="company_name" class="input">
      </div>
    </div>

    <div>
      <label class="block text-sm font-semibold text-gray-800 mb-1.5">회원 유형 *</label>
      <div class="flex gap-3">
        <label class="flex items-center gap-2 text-sm"><input type="radio" name="account_type" value="business" checked> 업체 회원</label>
        <label class="flex items-center gap-2 text-sm"><input type="radio" name="account_type" value="individual"> 개인 회원</label>
      </div>
    </div>

    <div class="grid sm:grid-cols-2 gap-4">
      <div>
        <label class="block text-sm font-semibold text-gray-800 mb-1.5">업종</label>
        <select name="business_type" class="input">
          <option value="">선택</option>
          <?php foreach (['venue'=>'예식장','dress'=>'드레스샵','studio'=>'스튜디오','makeup'=>'메이크업','planner'=>'웨딩플래너','assistant'=>'예식 도우미','mc'=>'사회자','designer'=>'디자이너','singer'=>'축가','other'=>'기타'] as $k=>$v): ?>
            <option value="<?= $k ?>"><?= $v ?></option>
          <?php endforeach; ?>
        </select>
      </div>
      <div>
        <label class="block text-sm font-semibold text-gray-800 mb-1.5">지역 *</label>
        <select name="region" required class="input">
          <option value="">선택</option>
          <?php foreach (['seoul'=>'서울','gyeonggi'=>'경기','incheon'=>'인천','busan'=>'부산','daegu'=>'대구','daejeon'=>'대전','gwangju'=>'광주','ulsan'=>'울산','sejong'=>'세종','gangwon'=>'강원','chungbuk'=>'충북','chungnam'=>'충남','jeonbuk'=>'전북','jeonnam'=>'전남','gyeongbuk'=>'경북','gyeongnam'=>'경남','jeju'=>'제주'] as $k=>$v): ?>
            <option value="<?= $k ?>"><?= $v ?></option>
          <?php endforeach; ?>
        </select>
      </div>
    </div>

    <div>
      <label class="block text-sm font-semibold text-gray-800 mb-1.5">연락처</label>
      <input type="tel" name="phone" placeholder="01012345678" class="input">
    </div>

    <button type="submit" class="btn-primary w-full justify-center py-3 mt-2">회원가입</button>
  </form>

  <p class="mt-6 text-center text-sm text-gray-500">
    이미 계정이 있으신가요?
    <a href="/login" class="font-semibold text-primary hover:underline">로그인</a>
  </p>
</div>
