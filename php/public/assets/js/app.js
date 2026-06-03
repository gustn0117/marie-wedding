// Marié — 클라이언트 JS (최소)
// 인증·CRUD는 PHP 서버에서 처리. JS는 UI 인터랙션에 집중.

document.addEventListener('DOMContentLoaded', function () {
  // 외부 링크는 새 창으로
  document.querySelectorAll('a[href^="http"]').forEach(function (a) {
    if (a.host !== location.host && !a.target) a.target = '_blank';
  });

  // 모바일 메뉴 토글 (추가 시 사용)
  var mobileBtn = document.querySelector('[data-mobile-menu]');
  var mobileNav = document.querySelector('[data-mobile-nav]');
  if (mobileBtn && mobileNav) {
    mobileBtn.addEventListener('click', function () {
      mobileNav.classList.toggle('hidden');
    });
  }

  // form submit 시 중복 클릭 방지
  document.querySelectorAll('form').forEach(function (form) {
    form.addEventListener('submit', function () {
      var btn = form.querySelector('button[type="submit"]');
      if (btn) {
        btn.disabled = true;
        setTimeout(function () { btn.disabled = false; }, 3000);
      }
    });
  });
});
