// 목표 경로: src/server/marketing/week-window.ts
//
// 주간 창(월요일 00:00 ~ 다음 월요일 00:00, 반열림 [start, end)) 계산 — 순수 함수.
// time.ts의 private weekStart와 동일 규칙((day+6)%7로 월요일까지 거슬러). GEO 주간 리포트 등에서 사용.
export type WeekWindow = { start: Date; end: Date; lastDay: Date; weekLabel: string };

// 로컬 자정 기준(start)과 일치하도록 로컬 달력 날짜로 포맷(toISOString의 UTC 변환 이탈 방지).
const ymd = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

/** now가 속한 주의 [월요일 00:00, 다음 월요일 00:00) 창과 표시 라벨을 반환한다. */
export function currentWeekWindow(now: Date = new Date()): WeekWindow {
  const start = new Date(now);
  start.setDate(start.getDate() - ((start.getDay() + 6) % 7));
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 7);
  const lastDay = new Date(end);
  lastDay.setDate(lastDay.getDate() - 1);
  return { start, end, lastDay, weekLabel: `${ymd(start)} ~ ${ymd(lastDay)}` };
}
