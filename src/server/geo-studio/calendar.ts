// GEO Studio · M5 — 실행 캘린더 (원본 calendar.py 이식).
import { isoAddDays, isoWeekday, isoDiffDays, todayIso } from "./py-compat";
import type { ExecutionTask } from "./models";

// AI 크롤러 활동이 활발한 요일(경험적). 월=0 … 일=6.
const OPTIMAL_WEEKDAYS: Record<number, string> = { 1: "화요일", 2: "수요일", 3: "목요일" };
const OPTIMAL_HOUR = "오전 10시";

/** 날짜 → 태스크 목록(날짜 오름차순). 원본 calendar_view. */
export function calendarView(tasks: ExecutionTask[]): Record<string, Array<Record<string, unknown>>> {
  const byDate = new Map<string, Array<Record<string, unknown>>>();
  for (const t of tasks) {
    const arr = byDate.get(t.dueDate) ?? [];
    arr.push({ type: t.taskType, title: t.title, assignee: t.assignee, status: t.status, channel: t.channel, geo_gate: t.geoScoreGate });
    byDate.set(t.dueDate, arr);
  }
  const out: Record<string, Array<Record<string, unknown>>> = {};
  for (const key of [...byDate.keys()].sort()) out[key] = byDate.get(key)!;
  return out;
}

/** 발행 예정일 근처의 최적 게시 시점 제안. */
export function suggestPublishTiming(dueDate: string): Record<string, string> {
  for (let offset = 0; offset < 7; offset++) {
    const cand = isoAddDays(dueDate, offset);
    const wd = isoWeekday(cand);
    if (wd in OPTIMAL_WEEKDAYS) {
      return {
        recommended_date: cand,
        weekday: OPTIMAL_WEEKDAYS[wd],
        recommended_time: OPTIMAL_HOUR,
        reason: "AI 크롤러 인덱싱 활동이 활발한 요일·시간대"
      };
    }
  }
  return { recommended_date: dueDate, weekday: "", recommended_time: OPTIMAL_HOUR, reason: "기본 제안" };
}

/** 마감 임박 태스크(기획안 2.4 D-1 알림). */
export function upcomingDeadlines(tasks: ExecutionTask[], withinDays = 1, today?: string): ExecutionTask[] {
  const ref = today ?? todayIso();
  return tasks.filter((t) => {
    if (t.status === "done") return false;
    const diff = isoDiffDays(t.dueDate, ref);
    return diff >= 0 && diff <= withinDays;
  });
}
