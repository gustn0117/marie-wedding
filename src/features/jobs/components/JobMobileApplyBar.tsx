'use client';

import { useEffect, useState } from 'react';

interface Props {
  label: string;
  disabled?: boolean;
  /** 차단 사유 — 설정되면 라벨 대신 표시되고 클릭 비활성. */
  blockReason?: string | null;
}

export default function JobMobileApplyBar({ label, disabled, blockReason }: Props) {
  const [show, setShow] = useState(true);

  useEffect(() => {
    // 지원 폼이 화면에 들어오면 sticky 바 숨김
    const target = document.getElementById('apply');
    if (!target || !('IntersectionObserver' in window)) return;
    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        setShow(!entry.isIntersecting);
      },
      { rootMargin: '0px 0px -200px 0px' },
    );
    observer.observe(target);
    return () => observer.disconnect();
  }, []);

  if (!show) return null;

  if (blockReason) {
    return (
      <div className="fixed bottom-0 inset-x-0 z-40 border-t border-gray-200 bg-white p-3 shadow-lg lg:hidden">
        <div
          className="block w-full text-center rounded bg-gray-100 text-gray-500 py-3 text-sm font-bold"
          aria-disabled="true"
        >
          {blockReason}
        </div>
      </div>
    );
  }

  return (
    <div className="fixed bottom-0 inset-x-0 z-40 border-t border-gray-200 bg-white p-3 shadow-lg lg:hidden">
      <a
        href="#apply"
        className={`block w-full text-center btn-primary py-3 ${disabled ? 'pointer-events-none opacity-50' : ''}`}
      >
        {label}
      </a>
    </div>
  );
}
