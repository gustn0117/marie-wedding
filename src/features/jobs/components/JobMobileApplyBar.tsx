'use client';

import { useEffect, useState } from 'react';

interface Props {
  label: string;
  disabled?: boolean;
}

export default function JobMobileApplyBar({ label, disabled }: Props) {
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
