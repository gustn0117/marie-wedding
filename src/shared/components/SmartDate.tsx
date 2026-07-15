'use client';

import { useEffect, useRef, useState } from 'react';

const MONTHS = ['1월', '2월', '3월', '4월', '5월', '6월', '7월', '8월', '9월', '10월', '11월', '12월'];
const WEEK = ['일', '월', '화', '수', '목', '금', '토'];

interface Props {
  value: string; // 'YYYY-MM' (month) 또는 'YYYY-MM-DD' (day)
  onChange: (value: string) => void;
  granularity?: 'month' | 'day';
  placeholder?: string;
  disabled?: boolean;
  /** 미래 선택 금지(예: 생년월일·취득일·경력) */
  noFuture?: boolean;
}

function parse(value: string): { y: number; m: number; d: number } | null {
  const parts = value.split('-').map(Number);
  if (!parts[0] || !parts[1]) return null;
  return { y: parts[0], m: parts[1] - 1, d: parts[2] || 1 };
}

const pad = (n: number) => String(n).padStart(2, '0');

/**
 * 이력서용 날짜/월 선택 — 과거 허용, 연도 그리드 점프, 월 단위 지원.
 * 프로젝트 미니멀 팔레트(흰/검/회색+네이비) 톤.
 */
export default function SmartDate({ value, onChange, granularity = 'day', placeholder = '선택', disabled, noFuture }: Props) {
  const [open, setOpen] = useState(false);
  const [pane, setPane] = useState<'main' | 'years'>('main');
  const ref = useRef<HTMLDivElement>(null);
  const now = new Date();
  const parsed = parse(value);
  const [vy, setVy] = useState(parsed?.y ?? now.getFullYear());
  const [vm, setVm] = useState(parsed?.m ?? now.getMonth());

  useEffect(() => {
    if (!open) return;
    if (parsed) { setVy(parsed.y); setVm(parsed.m); }
    setPane('main');
    const onDoc = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const display = !parsed ? '' : granularity === 'month'
    ? `${parsed.y}년 ${parsed.m + 1}월`
    : `${parsed.y}년 ${parsed.m + 1}월 ${parsed.d}일`;

  const pickMonth = (m: number) => { onChange(`${vy}-${pad(m + 1)}`); setOpen(false); };
  const pickDay = (d: number) => { onChange(`${vy}-${pad(vm + 1)}-${pad(d)}`); setOpen(false); };
  const shiftMonth = (delta: number) => {
    const base = new Date(vy, vm + delta, 1);
    setVy(base.getFullYear()); setVm(base.getMonth());
  };

  const isFutureMonth = (y: number, m: number) => noFuture && (y > now.getFullYear() || (y === now.getFullYear() && m > now.getMonth()));
  const yearGridStart = Math.floor(vy / 12) * 12;

  const firstDay = new Date(vy, vm, 1).getDay();
  const daysIn = new Date(vy, vm + 1, 0).getDate();
  const cells: (number | null)[] = [...Array(firstDay).fill(null), ...Array.from({ length: daysIn }, (_, i) => i + 1)];

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((v) => !v)}
        className="input-field flex w-full items-center justify-between text-left disabled:bg-gray-100 disabled:cursor-not-allowed"
      >
        <span className={display ? 'text-gray-900' : 'text-gray-400'}>{display || placeholder}</span>
        <svg className="h-4 w-4 shrink-0 text-gray-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
        </svg>
      </button>
      {value && !disabled && (
        <button type="button" onClick={(e) => { e.stopPropagation(); onChange(''); }} className="absolute right-10 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600" aria-label="지우기">
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
        </button>
      )}

      {open && (
        <div className="absolute z-50 mt-1 w-[268px] rounded-lg border border-gray-200 bg-white p-3 shadow-xl">
          {/* 헤더 */}
          <div className="mb-2 flex items-center justify-between">
            <button type="button" onClick={() => pane === 'years' ? setVy(vy - 12) : (granularity === 'month' ? setVy(vy - 1) : shiftMonth(-1))} className="rounded p-1.5 hover:bg-gray-100">
              <svg className="h-4 w-4 text-gray-500" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" /></svg>
            </button>
            <button type="button" onClick={() => setPane(pane === 'years' ? 'main' : 'years')} className="rounded px-2 py-1 text-sm font-bold text-gray-900 hover:bg-gray-100">
              {pane === 'years' ? `${yearGridStart}–${yearGridStart + 11}` : granularity === 'month' ? `${vy}년` : `${vy}년 ${MONTHS[vm]}`}
            </button>
            <button type="button" onClick={() => pane === 'years' ? setVy(vy + 12) : (granularity === 'month' ? setVy(vy + 1) : shiftMonth(1))} className="rounded p-1.5 hover:bg-gray-100">
              <svg className="h-4 w-4 text-gray-500" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" /></svg>
            </button>
          </div>

          {pane === 'years' ? (
            <div className="grid grid-cols-4 gap-1">
              {Array.from({ length: 12 }, (_, i) => yearGridStart + i).map((y) => {
                const disabledY = noFuture && y > now.getFullYear();
                return (
                  <button key={y} type="button" disabled={disabledY} onClick={() => { setVy(y); setPane('main'); }}
                    className={`rounded py-2 text-sm ${y === vy ? 'bg-primary font-bold text-white' : disabledY ? 'text-gray-300' : 'text-gray-700 hover:bg-gray-100'}`}>
                    {y}
                  </button>
                );
              })}
            </div>
          ) : granularity === 'month' ? (
            <div className="grid grid-cols-3 gap-1">
              {MONTHS.map((label, m) => {
                const sel = parsed?.y === vy && parsed?.m === m;
                const dis = isFutureMonth(vy, m);
                return (
                  <button key={label} type="button" disabled={dis} onClick={() => pickMonth(m)}
                    className={`rounded py-2.5 text-sm ${sel ? 'bg-primary font-bold text-white' : dis ? 'text-gray-300' : 'text-gray-700 hover:bg-gray-100'}`}>
                    {label}
                  </button>
                );
              })}
            </div>
          ) : (
            <>
              <div className="mb-1 grid grid-cols-7">
                {WEEK.map((d, i) => <div key={d} className={`py-1 text-center text-[11px] font-medium ${i === 0 ? 'text-state-urgent' : i === 6 ? 'text-blue-400' : 'text-gray-400'}`}>{d}</div>)}
              </div>
              <div className="grid grid-cols-7">
                {cells.map((day, i) => {
                  if (day === null) return <div key={`e${i}`} />;
                  const sel = parsed?.y === vy && parsed?.m === vm && parsed?.d === day;
                  const dis = noFuture && new Date(vy, vm, day) > now;
                  const dow = new Date(vy, vm, day).getDay();
                  return (
                    <button key={day} type="button" disabled={dis} onClick={() => pickDay(day)}
                      className={`flex aspect-square w-full items-center justify-center rounded text-sm ${sel ? 'bg-primary font-semibold text-white' : dis ? 'cursor-not-allowed text-gray-300' : dow === 0 ? 'text-state-urgent hover:bg-gray-100' : 'text-gray-700 hover:bg-gray-100'}`}>
                      {day}
                    </button>
                  );
                })}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
