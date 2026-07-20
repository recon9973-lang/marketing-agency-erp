// 서버 위젯 — 대시보드 내부 미니 월간 캘린더. 이번 달 일정을 조회해 클라이언트 캘린더에 넘긴다.
import type { CalendarEventKind } from "@/domain/types";
import { fetchMonthCalendarEvents } from "@/server/repositories/calendar";
import { MiniCalendar, type DayEvent } from "@/components/dashboard/MiniCalendar";
import type { CurrentUser } from "@/server/session";

export async function MiniCalendarWidget({ user }: { user: CurrentUser }) {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const start = new Date(year, month, 1);
  const end = new Date(year, month + 1, 1);
  const todayNum = now.getDate();

  const events = await fetchMonthCalendarEvents(user, start, end).catch(() => []);
  const eventsByDay: Record<number, DayEvent[]> = {};
  for (const e of events) {
    (eventsByDay[e.day] ??= []).push({ kind: e.kind, title: e.title, time: e.time });
  }

  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const startWeekday = start.getDay(); // 0=일
  const cells: (number | null)[] = [];
  for (let i = 0; i < startWeekday; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);

  const usedKinds = [...new Set(events.map((e) => e.kind))] as CalendarEventKind[];

  return (
    <MiniCalendar
      year={year}
      month={month}
      cells={cells}
      eventsByDay={eventsByDay}
      usedKinds={usedKinds}
      todayNum={todayNum}
    />
  );
}
