"use client";

// 대시보드 미니 캘린더(클라이언트) — 날짜 클릭 시 해당일 일정 모달 + 캘린더로 바로 이동.
import { useState } from "react";
import Link from "next/link";
import type { Route } from "next";
import { CalendarDays, ArrowUpRight, X, ArrowRight } from "lucide-react";
import { CalendarEventKind } from "@/domain/types";

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

export type DayEvent = { kind: CalendarEventKind; title: string; time: string };

export function MiniCalendar({
  year,
  month,
  cells,
  eventsByDay,
  usedKinds,
  todayNum
}: {
  year: number;
  month: number; // 0-based
  cells: (number | null)[];
  eventsByDay: Record<number, DayEvent[]>;
  usedKinds: CalendarEventKind[];
  todayNum: number;
}) {
  const [selected, setSelected] = useState<number | null>(null);
  const pad = (n: number) => String(n).padStart(2, "0");
  const iso = (d: number) => `${year}-${pad(month + 1)}-${pad(d)}`;
  const selectedEvents = selected ? eventsByDay[selected] ?? [] : [];

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
          const evs = eventsByDay[d];
          const kinds = [...new Set((evs ?? []).map((e) => e.kind))];
          const isToday = d === todayNum;
          return (
            <button
              key={d}
              type="button"
              onClick={() => setSelected(d)}
              className={`flex min-h-[36px] flex-col items-center rounded-md py-1 transition hover:bg-surface ${isToday ? "bg-brand-soft ring-1 ring-brand/40" : ""}`}
            >
              <span className={`text-[11px] ${isToday ? "font-bold text-brand-strong" : "text-slate-600"}`}>{d}</span>
              {kinds.length > 0 && (
                <span className="mt-0.5 flex flex-wrap justify-center gap-0.5">
                  {kinds.slice(0, 3).map((k) => (
                    <span key={k} className={`h-1.5 w-1.5 rounded-full ${KIND_DOT[k]}`} />
                  ))}
                </span>
              )}
            </button>
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

      {/* 날짜 일정 모달 */}
      {selected !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setSelected(null)}>
          <div className="w-full max-w-sm rounded-2xl border border-line bg-card p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-bold text-ink">
                {month + 1}월 {selected}일 일정 <span className="text-slate-400">({selectedEvents.length})</span>
              </p>
              <button type="button" onClick={() => setSelected(null)} className="rounded p-1 text-slate-400 hover:bg-surface hover:text-ink" aria-label="닫기">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-3 max-h-72 space-y-1.5 overflow-y-auto">
              {selectedEvents.length === 0 ? (
                <p className="rounded-lg border border-dashed border-line bg-surface/40 px-3 py-6 text-center text-xs text-slate-400">이 날짜에 등록된 일정이 없습니다.</p>
              ) : (
                selectedEvents.map((e, i) => (
                  <div key={i} className="flex items-center gap-2 rounded-lg border border-line bg-surface/30 px-3 py-2">
                    <span className={`h-2 w-2 shrink-0 rounded-full ${KIND_DOT[e.kind]}`} />
                    <span className="shrink-0 text-[11px] tabular-nums text-slate-400">{e.time}</span>
                    <span className="min-w-0 flex-1 truncate text-sm text-ink">{e.title}</span>
                    <span className="shrink-0 rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-500">{KIND_LABEL[e.kind]}</span>
                  </div>
                ))
              )}
            </div>

            <Link
              href={`/calendar?date=${iso(selected)}` as Route}
              className="mt-4 flex items-center justify-center gap-1 rounded-lg bg-brand py-2.5 text-sm font-semibold text-white hover:bg-brand-strong"
            >
              캘린더로 이동 <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      )}
    </section>
  );
}
