// 서버 위젯 — 대시보드 내부 미니 월간 캘린더. 이번 달 일정에 종류별 점 표시, /calendar로 이동.
import Link from "next/link";
import { CalendarDays, ArrowUpRight } from "lucide-react";
import { CalendarEventKind } from "@/domain/types";
import { fetchMonthCalendarEvents } from "@/server/repositories/calendar";
import type { CurrentUser } from "@/server/session";

const KIND_DOT: Record<CalendarEventKind, string> = {
  [CalendarEventKind.TASK]: "bg-amber-500",
  [CalendarEventKind.CLIENT_MEETING]: "bg-sky-500",
  [CalendarEventKind.REPORT_DEADLINE]: "bg-violet-500",
  [CalendarEventKind.LEAVE]: "bg-emerald-500",
  [CalendarEventKind.INTERNAL_INSTRUCTION]: "bg-rose-500"
};
const KIND_LABEL: Record<CalendarEventKind, string> = {
  [CalendarEventKind.TASK]: "업무",
  [CalendarEventKind.CLIENT_MEETING]: "미팅",
  [CalendarEventKind.REPORT_DEADLINE]: "마감",
  [CalendarEventKind.LEAVE]: "연차",
  [CalendarEventKind.INTERNAL_INSTRUCTION]: "지시"
};
const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];

export async function MiniCalendarWidget({ user }: { user: CurrentUser }) {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const start = new Date(year, month, 1);
  const end = new Date(year, month + 1, 1);
  const todayNum = now.getDate();

  const events = await fetchMonthCalendarEvents(user, start, end).catch(() => []);
  const byDay = new Map<number, Set<CalendarEventKind>>();
  for (const e of events) {
    if (!byDay.has(e.day)) byDay.set(e.day, new Set());
    byDay.get(e.day)!.add(e.kind);
  }

  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const startWeekday = start.getDay(); // 0=일
  const cells: (number | null)[] = [];
  for (let i = 0; i < startWeekday; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);

  const usedKinds = [...new Set(events.map((e) => e.kind))];

  return (
    <section className="rounded-2xl border border-line bg-card p-4">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <CalendarDays className="h-4 w-4 text-brand" />
          <h2 className="text-sm font-bold text-ink">
            {year}년 {month + 1}월
          </h2>
        </div>
        <Link href="/calendar" className="inline-flex items-center gap-0.5 text-xs font-semibold text-brand hover:text-brand-strong">
          캘린더 <ArrowUpRight className="h-3 w-3" />
        </Link>
      </div>

      <div className="mt-3 grid grid-cols-7 gap-1 text-center">
        {WEEKDAYS.map((w, i) => (
          <div key={w} className={`pb-1 text-[10px] font-bold ${i === 0 ? "text-rose-400" : i === 6 ? "text-sky-400" : "text-slate-400"}`}>
            {w}
          </div>
        ))}
        {cells.map((d, i) => {
          if (d === null) return <div key={`e${i}`} />;
          const kinds = byDay.get(d);
          const isToday = d === todayNum;
          return (
            <div
              key={d}
              className={`flex min-h-[36px] flex-col items-center rounded-md py-1 ${isToday ? "bg-brand-soft ring-1 ring-brand/40" : ""}`}
            >
              <span className={`text-[11px] ${isToday ? "font-bold text-brand-strong" : "text-slate-600"}`}>{d}</span>
              {kinds && (
                <span className="mt-0.5 flex flex-wrap justify-center gap-0.5">
                  {[...kinds].slice(0, 3).map((k) => (
                    <span key={k} className={`h-1.5 w-1.5 rounded-full ${KIND_DOT[k]}`} />
                  ))}
                </span>
              )}
            </div>
          );
        })}
      </div>

      {usedKinds.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1 border-t border-line pt-2">
          {usedKinds.map((k) => (
            <span key={k} className="flex items-center gap-1 text-[10px] text-slate-500">
              <span className={`h-1.5 w-1.5 rounded-full ${KIND_DOT[k]}`} /> {KIND_LABEL[k]}
            </span>
          ))}
        </div>
      )}
    </section>
  );
}
