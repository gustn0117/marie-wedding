<?php /** @var string $active */ ?>
<nav class="rounded-xl border border-gray-200 bg-white p-2 mb-6">
  <ul class="flex flex-wrap gap-1 text-sm font-semibold">
    <?php
      $items = [
        ['index', '/mypage', '대시보드'],
        ['profile', '/mypage/profile', '프로필'],
        ['directory', '/mypage/directory', '업체 정보'],
        ['jobs', '/mypage/jobs', '내 공고'],
        ['posts', '/mypage/posts', '내 글'],
        ['applications', '/mypage/applications', '신청 내역'],
      ];
      foreach ($items as [$k, $href, $label]):
        $isActive = ($active ?? '') === $k;
    ?>
      <li><a href="<?= $href ?>" class="block px-3 py-2 rounded <?= $isActive ? 'bg-primary text-white' : 'text-gray-700 hover:bg-gray-100' ?>"><?= $label ?></a></li>
    <?php endforeach; ?>
    <li class="ml-auto"><a href="/logout" class="block px-3 py-2 text-gray-500 hover:text-red-600">로그아웃</a></li>
  </ul>
</nav>
