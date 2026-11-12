// Design Ref: §5.4 — 샘플 날짜를 "오늘로부터 며칠"로 적기 위한 날짜 도우미
// 날짜는 모두 "YYYY-MM-DD" 문자열로 다룬다. (시각·시간대 때문에 하루가 어긋나는 일을 막기 위해)

const DAY_MS = 24 * 60 * 60 * 1000;

/** "YYYY-MM-DD" → UTC 자정의 밀리초 */
function toUtcMs(date: string): number {
  const [y, m, d] = date.split("-").map(Number);
  return Date.UTC(y, m - 1, d);
}

/** 밀리초 → "YYYY-MM-DD" */
function fromUtcMs(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

/** 오늘 날짜 (한국 시간 기준 "YYYY-MM-DD") */
export function todayString(now: Date = new Date()): string {
  // en-CA 형식이 YYYY-MM-DD 이다
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul" }).format(now);
}

/** 날짜에 n일을 더한다 (음수면 뺀다) */
export function addDays(date: string, days: number): string {
  return fromUtcMs(toUtcMs(date) + days * DAY_MS);
}

/** to - from 이 며칠인지 (to가 더 늦으면 양수) */
export function daysBetween(from: string, to: string): number {
  return Math.round((toUtcMs(to) - toUtcMs(from)) / DAY_MS);
}

/** 오늘로부터 n일 뒤(음수면 n일 전) 날짜 — 샘플 데이터에서 사용 */
export function daysFromToday(days: number, today: string = todayString()): string {
  return addDays(today, days);
}
