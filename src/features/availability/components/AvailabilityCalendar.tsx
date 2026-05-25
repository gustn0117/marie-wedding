'use client';

import { useEffect, useMemo, useState } from 'react';
import type { AvailabilitySlot, AvailabilityStatus } from '@/types/database';
import { availabilityService, monthBounds, ymd } from '@/features/availability/services/availabilityService';
import { toast } from '@/shared/components/Toast';

interface Props {
  profileId: string;
  editable: boolean;
}

const KOREAN_DAYS = ['일', '월', '화', '수', '목', '금', '토'];

export default function AvailabilityCalendar({ profileId, editable }: Props) {
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());
  const [slots, setSlots] = useState<Record<string, AvailabilitySlot>>({});
  const [busy, setBusy] = useState(false);

  const days = useMemo(() => {
    const first = new Date(year, month, 1);
    const last = new Date(year, month + 1, 0);
    const startWeekday = first.getDay();
    const total = last.getDate();
    const cells: Array<{ date: Date; inMonth: boolean }> = [];
    for (let i = 0; i < startWeekday; i++) {
      const d = new Date(year, month, -startWeekday + i + 1);
      cells.push({ date: d, inMonth: false });
    }
    for (let i = 1; i <= total; i++) {
      cells.push({ date: new Date(year, month, i), inMonth: true });
    }
    while (cells.length % 7 !== 0) {
      const last = cells[cells.length - 1].date;
      cells.push({ date: new Date(last.getFullYear(), last.getMonth(), last.getDate() + 1), inMonth: false });
    }
    return cells;
  }, [year, month]);

  useEffect(() => {
    const { from, to } = monthBounds(year, month);
    setBusy(true);
    availabilityService.listForProfile(profileId, from, to, { publicOnly: !editable })
      .then((rows) => {
        const map: Record<string, AvailabilitySlot> = {};
        rows.forEach((r) => { map[r.date] = r; });
        setSlots(map);
      })
      .catch(() => setSlots({}))
      .finally(() => setBusy(false));
  }, [profileId, year, month, editable]);

  function nextStatus(curr: AvailabilityStatus | null): AvailabilityStatus | null {
    if (curr === null) return 'available';
    if (curr === 'available') return 'busy';
    return null;
  }

  async function onCellClick(date: Date) {
    if (!editable) return;
    const key = ymd(date);
    const curr = slots[key]?.status ?? null;
    const next = nextStatus(curr);
    try {
      if (next === null && slots[key]) {
        await availabilityService.remove(slots[key].id);
        setSlots((prev) => { const c = { ...prev }; delete c[key]; return c; });
      } else if (next) {
        const updated = await availabilityService.upsert({ profileId, date: key, status: next });
        setSlots((prev) => ({ ...prev, [key]: updated }));
      }
    } catch {
      toast('업데이트에 실패했습니다.', 'error');
    }
  }

  function move(delta: number) {
    const d = new Date(year, month + delta, 1);
    setYear(d.getFullYear()); setMonth(d.getMonth());
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <button onClick={() => move(-1)} className="text-sm font-bold text-gray-700 hover:text-primary">← 이전</button>
        <h3 className="text-base font-bold text-gray-900">{year}년 {month + 1}월</h3>
        <button onClick={() => move(1)} className="text-sm font-bold text-gray-700 hover:text-primary">다음 →</button>
      </div>
      {editable && (
        <p className="text-xs text-gray-500 mb-2">날짜를 누르면 가능 → 일정 있음 → 표시 해제 순으로 바뀝니다.</p>
      )}
      <div className="grid grid-cols-7 text-center text-xs text-gray-500 mb-1">
        {KOREAN_DAYS.map((d, i) => (
          <span key={d} className={`py-1 ${i === 0 ? 'text-state-urgent' : ''}`}>{d}</span>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {days.map(({ date, inMonth }) => {
          const key = ymd(date);
          const slot = slots[key];
          const isToday = key === ymd(today);
          const base = 'aspect-square flex flex-col items-center justify-center border text-xs';
          const stateCls = !inMonth
            ? 'border-transparent text-gray-300'
            : slot?.status === 'available'
              ? 'border-primary bg-primary/10 text-primary font-bold'
              : slot?.status === 'busy'
                ? 'border-gray-400 bg-gray-100 text-gray-600 line-through'
                : 'border-gray-200 text-gray-700';
          const todayCls = isToday && inMonth ? 'ring-2 ring-primary' : '';
          return (
            <button
              key={key + (inMonth ? '' : 'o')}
              type="button"
              disabled={busy || !inMonth || !editable}
              onClick={() => onCellClick(date)}
              className={`${base} ${stateCls} ${todayCls} ${editable && inMonth ? 'hover:border-primary' : 'cursor-default'}`}
            >
              <span>{date.getDate()}</span>
              {inMonth && slot?.status === 'available' && <span className="text-[10px] mt-0.5">가능</span>}
              {inMonth && slot?.status === 'busy' && <span className="text-[10px] mt-0.5">예약</span>}
            </button>
          );
        })}
      </div>
      <div className="mt-4 flex gap-4 text-xs text-gray-600">
        <span className="inline-flex items-center gap-1.5"><span className="w-3 h-3 border border-primary bg-primary/10" />가능</span>
        <span className="inline-flex items-center gap-1.5"><span className="w-3 h-3 border border-gray-400 bg-gray-100" />일정 있음</span>
      </div>
    </div>
  );
}
