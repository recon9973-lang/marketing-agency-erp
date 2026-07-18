// 격자형 월간 달력 — 서버 렌더(순수). 셀별 이벤트 배치·색상·오버플로.
// 데이터/색상 결합을 피하려 이벤트는 미리 {id,title,toneClass,label}로 매핑해 받는다.

export type GridEvent = { id: string; title: string; toneClass: string; label: string };

const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];

export function MonthCalendar({
  year,
  monthIndex,
  eventsByDay,
  todayKey,
  prevHref,
  nextHref,
  monthLabel
}: {
  year: number;
  monthIndex: number; // 0-based
  eventsByDay: Record<string, GridEvent[]>;
  todayKey: string; // YYYY-MM-DD (KST)
  prevHref: string;
  nextHref: string;
  monthLabel: string;
}) {
  const firstWeekday = new Date(year, monthIndex, 1).getDay(); // 0=일
  const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
  const totalCells = Math.ceil((firstWeekday + daysInMonth) / 7) * 7;
  const pad = (n: number) => String(n).padStart(2, "0");

  const cells = Array.from({ length: totalCells }, (_, i) => {
    const dayNum = i - firstWeekday + 1;
    if (dayNum < 1 || dayNum > daysInMonth) return null;
    const key = `${year}-${pad(monthIndex + 1)}-${pad(dayNum)}`;
    return { dayNum, key, dow: i % 7, events: eventsByDay[key] ?? [] };
  });

  return (
    <div className="rounded-2xl border border-line bg-card p-4">
      <div className="mb-3 flex items-center justify-between">
        <a href={prevHref} className="rounded-lg border border-line px-2.5 py-1 text-sm text-slate-600 hover:bg-surface" aria-label="이전 달">‹</a>
        <p className="text-sm font-bold text-ink">{monthLabel}</p>
        <a href={nextHref} className="rounded-lg border border-line px-2.5 py-1 text-sm text-slate-600 hover:bg-surface" aria-label="다음 달">›</a>
      </div>

      <div className="grid grid-cols-7 border-l border-t border-line">
        {WEEKDAYS.map((w, i) => (
          <div key={w} className={`border-b border-r border-line bg-surface py-1.5 text-center text-xs font-semibold ${i === 0 ? "text-rose-500" : i === 6 ? "text-sky-500" : "text-slate-500"}`}>{w}</div>
        ))}
        {cells.map((cell, i) => (
          <div key={i} className={`min-h-[92px] border-b border-r border-line p-1.5 align-top ${cell?.key === todayKey ? "bg-brand/5" : "bg-card"}`}>
            {cell && (
              <>
                <div className={`mb-1 text-right text-xs font-medium ${cell.dow === 0 ? "text-rose-500" : cell.dow === 6 ? "text-sky-500" : "text-slate-500"} ${cell.key === todayKey ? "font-bold text-brand" : ""}`}>{cell.dayNum}</div>
                <div className="space-y-0.5">
                  {cell.events.slice(0, 3).map((e) => (
                    <div key={e.id} className={`truncate rounded border px-1 py-0.5 text-[10px] font-medium ${e.toneClass}`} title={`${e.label} · ${e.title}`}>{e.title}</div>
                  ))}
                  {cell.events.length > 3 && <div className="pl-1 text-[10px] text-slate-400">+{cell.events.length - 3}건</div>}
                </div>
              </>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
