/** PostgreSQL timestamptz 문자열을 표기 형식/시간대가 달라도 같은 순간으로 비교한다. */
export function sameNullableTimestamp(left: unknown, right: unknown): boolean {
  if (left == null || left === '') return right == null || right === '';
  if (right == null || right === '') return false;
  if (typeof left !== 'string' || typeof right !== 'string') return false;

  const leftTime = Date.parse(left);
  const rightTime = Date.parse(right);
  return Number.isFinite(leftTime) && Number.isFinite(rightTime) && leftTime === rightTime;
}
