<?php /** @var ?array $job */ /** @var string $mode */
$isEdit = ($mode ?? 'create') === 'edit' && !empty($job);
?>
<div class="max-w-3xl mx-auto px-4 py-10">
  <nav class="text-sm text-gray-500 mb-4">
    <a href="/jobs" class="hover:text-primary">채용 정보</a>
    <span class="mx-2">›</span>
    <span class="text-gray-900 font-medium"><?= $isEdit ? '공고 수정' : '공고 등록' ?></span>
  </nav>

  <h1 class="text-3xl font-bold text-gray-900 mb-2 tracking-tight"><?= $isEdit ? '공고 수정' : '공고 등록' ?></h1>
  <p class="text-sm text-gray-500 mb-8">웨딩업계 채용 공고를 등록하고 지원자를 관리합니다.</p>

  <form action="<?= $isEdit ? '/jobs/' . View::e($job['id']) . '/edit' : '/jobs/new' ?>" method="POST" class="space-y-5">
    <input type="hidden" name="_csrf" value="<?= csrf_token() ?>">
    <input type="hidden" name="posting_type" value="hiring">

    <div class="rounded-xl border border-gray-200 bg-white p-5 md:p-6">
      <label class="block text-sm font-semibold text-gray-800 mb-2">공고 유형 *</label>
      <div class="rounded-lg border-2 border-primary bg-primary-50 px-4 py-3">
        <p class="text-sm font-bold text-primary">채용 공고</p>
        <p class="text-xs text-gray-500 mt-0.5">스태프·직원·프리랜서 채용 공고만 등록할 수 있습니다.</p>
      </div>
    </div>

    <div class="rounded-xl border border-gray-200 bg-white p-5 md:p-6 grid sm:grid-cols-2 gap-4">
      <div class="sm:col-span-2">
        <label class="block text-sm font-semibold text-gray-800 mb-1.5">제목 *</label>
        <input type="text" name="title" required maxlength="200" value="<?= View::e($job['title'] ?? '') ?>" placeholder="예) 강남 예식장 주말 도우미 모집" class="input">
      </div>
      <div>
        <label class="block text-sm font-semibold text-gray-800 mb-1.5">업종 *</label>
        <select name="business_type" required class="input">
          <option value="">선택</option>
          <?php foreach (['venue'=>'예식장','dress'=>'드레스샵','studio'=>'스튜디오','makeup'=>'메이크업','planner'=>'웨딩플래너','assistant'=>'예식 도우미','mc'=>'사회자','designer'=>'디자이너','singer'=>'축가','other'=>'기타'] as $k=>$v): ?>
            <option value="<?= $k ?>" <?= ($job['business_type'] ?? '') === $k ? 'selected' : '' ?>><?= $v ?></option>
          <?php endforeach; ?>
        </select>
      </div>
      <div>
        <label class="block text-sm font-semibold text-gray-800 mb-1.5">지역 *</label>
        <select name="region" required class="input">
          <option value="">선택</option>
          <?php foreach (['seoul'=>'서울','gyeonggi'=>'경기','incheon'=>'인천','busan'=>'부산','daegu'=>'대구','daejeon'=>'대전','gwangju'=>'광주','ulsan'=>'울산','sejong'=>'세종','gangwon'=>'강원','chungbuk'=>'충북','chungnam'=>'충남','jeonbuk'=>'전북','jeonnam'=>'전남','gyeongbuk'=>'경북','gyeongnam'=>'경남','jeju'=>'제주'] as $k=>$v): ?>
            <option value="<?= $k ?>" <?= ($job['region'] ?? '') === $k ? 'selected' : '' ?>><?= $v ?></option>
          <?php endforeach; ?>
        </select>
      </div>
      <div>
        <label class="block text-sm font-semibold text-gray-800 mb-1.5">고용형태 *</label>
        <select name="employment_type" required class="input">
          <?php foreach (['full_time'=>'정규직','contract'=>'계약직','part_time'=>'단기알바'] as $k=>$v): ?>
            <option value="<?= $k ?>" <?= ($job['employment_type'] ?? 'full_time') === $k ? 'selected' : '' ?>><?= $v ?></option>
          <?php endforeach; ?>
        </select>
      </div>
      <div>
        <label class="block text-sm font-semibold text-gray-800 mb-1.5">급여</label>
        <input type="text" name="salary_info" value="<?= View::e($job['salary_info'] ?? '') ?>" placeholder="예) 시급 12,000원 / 월 300만원" class="input">
      </div>
      <div class="sm:col-span-2">
        <label class="block text-sm font-semibold text-gray-800 mb-1.5">마감일</label>
        <input type="date" name="deadline" value="<?= View::e($job['deadline'] ? substr($job['deadline'], 0, 10) : '') ?>" class="input">
        <p class="text-xs text-gray-400 mt-1">비워두면 상시 채용으로 표시됩니다.</p>
      </div>
    </div>

    <div class="rounded-xl border border-gray-200 bg-white p-5 md:p-6">
      <label class="block text-sm font-semibold text-gray-800 mb-1.5">상세 내용 *</label>
      <textarea name="description" required rows="12" maxlength="20000" placeholder="업무 내용·우대 사항·근무 조건·지원 방법 등을 자유롭게 작성하세요"><?= View::e($job['description'] ?? '') ?></textarea>
      <p class="text-xs text-gray-400 mt-1">광고·연락처 유도·차별적 표현은 자동 검토 대상입니다.</p>
    </div>

    <div class="flex justify-end gap-2 pt-2">
      <a href="/jobs" class="btn-outline">취소</a>
      <button type="submit" class="btn-primary"><?= $isEdit ? '수정 저장' : '등록' ?></button>
    </div>
  </form>
</div>
