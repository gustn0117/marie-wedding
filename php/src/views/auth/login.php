<div class="max-w-md mx-auto px-4 py-16">
  <h1 class="text-3xl font-bold text-gray-900 mb-2 tracking-tight">로그인</h1>
  <p class="text-sm text-gray-500 mb-8">Marié에 다시 오신 것을 환영합니다.</p>

  <form action="/login" method="POST" class="space-y-4">
    <input type="hidden" name="_csrf" value="<?= csrf_token() ?>">
    <div>
      <label class="block text-sm font-semibold text-gray-800 mb-1.5">이메일</label>
      <input type="email" name="email" required autocomplete="email" placeholder="you@example.com" class="input">
    </div>
    <div>
      <label class="block text-sm font-semibold text-gray-800 mb-1.5">비밀번호</label>
      <input type="password" name="password" required autocomplete="current-password" placeholder="비밀번호" class="input">
    </div>
    <button type="submit" class="btn-primary w-full justify-center py-3">로그인</button>
  </form>

  <p class="mt-6 text-center text-sm text-gray-500">
    아직 계정이 없으신가요?
    <a href="/signup" class="font-semibold text-primary hover:underline">회원가입</a>
  </p>
</div>
