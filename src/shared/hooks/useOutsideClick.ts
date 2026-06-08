import { useEffect, useRef, type RefObject } from 'react';

/**
 * 외부 클릭/ESC 키 감지 hook.
 * 옛 패턴(`<div className="fixed inset-0 z-10" onClick={close}>`)을 대체.
 *
 * 옛 패턴의 문제:
 *   - viewport 전체를 덮어서 같은 페이지 다른 상호작용 요소의 첫 클릭을 흡수
 *   - 같은 리스트의 다른 dropdown 트리거가 오버레이 아래에 깔려 "1차 클릭 무시" 버그
 *   - 키보드(ESC) 지원 없음
 *
 * 본 hook은 mousedown capture phase + ESC 키 + touch를 통해
 * ref 외부에서 발생한 클릭만 onClose 호출.
 *
 * @example
 *   const ref = useOutsideClick<HTMLDivElement>(open, () => setOpen(false));
 *   <div ref={ref}>...</div>
 */
export function useOutsideClick<T extends HTMLElement>(
  active: boolean,
  onClose: () => void,
): RefObject<T> {
  const ref = useRef<T>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!active) return;

    const handlePointer = (e: MouseEvent | TouchEvent) => {
      const node = ref.current;
      if (!node) return;
      const target = e.target as Node | null;
      if (target && !node.contains(target)) {
        onCloseRef.current();
      }
    };

    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCloseRef.current();
    };

    // capture phase — outside 클릭이 다른 핸들러로 가기 전에 가로채서 close.
    // 이렇게 하면 사용자가 다른 dropdown 트리거를 클릭해도
    // 그 클릭의 default 동작(새 dropdown 열기)은 정상 진행되고
    // 동시에 현재 dropdown도 닫힘.
    document.addEventListener('mousedown', handlePointer, true);
    document.addEventListener('touchstart', handlePointer, true);
    document.addEventListener('keydown', handleKey);

    return () => {
      document.removeEventListener('mousedown', handlePointer, true);
      document.removeEventListener('touchstart', handlePointer, true);
      document.removeEventListener('keydown', handleKey);
    };
  }, [active]);

  return ref;
}
