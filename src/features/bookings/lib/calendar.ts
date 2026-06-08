// 캘린더 헬퍼 — pure functions, SSR/CSR 호환.
// Date 객체 직렬화는 ISO ymd (yyyy-mm-dd) 표준.

export interface MonthInfo {
  year: number;
  month: number; // 1-12
  ym: string;    // 'yyyy-mm'
  firstDay: Date;
  lastDay: Date;
}

export interface DayCell {
  ymd: string;          // 'yyyy-mm-dd'
  day: number;          // 1-31
  weekday: number;      // 0=Sun, 6=Sat
  isCurrentMonth: boolean;
  isToday: boolean;
  isWeekend: boolean;
}

export function parseYm(ym: string | undefined | null): MonthInfo {
  const now = new Date();
  let year = now.getFullYear();
  let month = now.getMonth() + 1;
  if (ym && /^\d{4}-\d{2}$/.test(ym)) {
    const [y, m] = ym.split('-').map(Number);
    if (y >= 1900 && y < 2100 && m >= 1 && m <= 12) {
      year = y;
      month = m;
    }
  }
  const firstDay = new Date(year, month - 1, 1);
  const lastDay = new Date(year, month, 0);
  return {
    year,
    month,
    ym: `${year}-${String(month).padStart(2, '0')}`,
    firstDay,
    lastDay,
  };
}

export function shiftMonth(ym: string, delta: number): string {
  const info = parseYm(ym);
  const d = new Date(info.year, info.month - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export function todayYmd(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function ymdFromDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/**
 * 6주(42칸) grid 생성 — 첫째 주는 이전 달 잔여, 마지막 주는 다음 달 잔여 포함.
 * Sunday-first.
 */
export function buildMonthCells(year: number, month: number): DayCell[] {
  const today = todayYmd();
  const firstOfMonth = new Date(year, month - 1, 1);
  const startWeekday = firstOfMonth.getDay(); // 0=Sun
  // grid 시작 = 1일이 속한 주의 일요일
  const gridStart = new Date(year, month - 1, 1 - startWeekday);

  const cells: DayCell[] = [];
  for (let i = 0; i < 42; i++) {
    const d = new Date(gridStart.getFullYear(), gridStart.getMonth(), gridStart.getDate() + i);
    const ymd = ymdFromDate(d);
    cells.push({
      ymd,
      day: d.getDate(),
      weekday: d.getDay(),
      isCurrentMonth: d.getMonth() === month - 1,
      isToday: ymd === today,
      isWeekend: d.getDay() === 0 || d.getDay() === 6,
    });
  }
  return cells;
}

export function ymdRangeOfMonthGrid(year: number, month: number): { from: string; to: string } {
  const cells = buildMonthCells(year, month);
  return { from: cells[0].ymd, to: cells[cells.length - 1].ymd };
}

export function formatKoreanDate(ymd: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(ymd)) return ymd;
  const [y, m, d] = ymd.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  const weekdays = ['일', '월', '화', '수', '목', '금', '토'];
  return `${y}년 ${m}월 ${d}일 ${weekdays[date.getDay()]}요일`;
}

export function dDayLabel(ymd: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(ymd)) return '';
  const [y, m, d] = ymd.split('-').map(Number);
  const target = new Date(y, m - 1, d);
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  target.setHours(0, 0, 0, 0);
  const diff = Math.round((target.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  if (diff === 0) return 'D-day';
  if (diff > 0) return `D-${diff}`;
  return `D+${Math.abs(diff)}`;
}
