/**
 * 오늘 날짜를 KST(한국 시간) 기준 'YYYY-MM-DD' 로 반환한다.
 *
 * `new Date().toISOString().slice(0,10)` 은 UTC 날짜라, KST 새벽 00:00~08:59
 * (= UTC 전날 15:00~23:59) 사이엔 '어제'가 되어 이벤트 상태·마감 계산이 하루 어긋난다.
 * KST 는 DST 가 없는 고정 UTC+9 이므로 UTC ms 에 +9h 후 UTC 날짜를 취하면 KST 캘린더 날짜다.
 */
export function todayKstIso(): string {
  return new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10);
}
