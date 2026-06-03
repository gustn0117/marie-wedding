<?php /** @var array $categories */ ?>
<div class="max-w-3xl mx-auto px-4 py-10">
  <nav class="text-sm text-gray-500 mb-4">
    <a href="/community" class="hover:text-primary">커뮤니티</a>
    <span class="mx-2">›</span>
    <span class="text-gray-900 font-medium">글쓰기</span>
  </nav>

  <h1 class="text-3xl font-bold text-gray-900 mb-6 tracking-tight">글쓰기</h1>

  <form action="/community/write" method="POST" class="space-y-4">
    <input type="hidden" name="_csrf" value="<?= csrf_token() ?>">

    <div>
      <label class="block text-sm font-semibold text-gray-800 mb-1.5">카테고리 *</label>
      <select name="category" required class="input">
        <?php foreach ($categories as $k => $v): ?>
          <option value="<?= $k ?>"><?= $v ?></option>
        <?php endforeach; ?>
      </select>
    </div>

    <div>
      <label class="block text-sm font-semibold text-gray-800 mb-1.5">제목 *</label>
      <input type="text" name="title" required maxlength="200" placeholder="제목을 입력하세요" class="input">
    </div>

    <div>
      <label class="block text-sm font-semibold text-gray-800 mb-1.5">본문 *</label>
      <textarea name="content" required rows="14" maxlength="20000" placeholder="내용을 입력하세요" class="input resize-y"></textarea>
      <p class="text-xs text-gray-400 mt-1">광고·욕설·차별적 표현은 자동으로 검토되며, 위반 시 비공개 처리됩니다.</p>
    </div>

    <div class="flex justify-end gap-2 pt-4 border-t border-gray-200">
      <a href="/community" class="btn-outline">취소</a>
      <button type="submit" class="btn-primary">등록</button>
    </div>
  </form>
</div>
