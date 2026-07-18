// 격자형 캘린더 — 서버 렌더(순수). 월간(주×일 격자) 또는 주간(1주 7일) 모드.
// 데이터/색상 결합을 피하려 이벤트는 미리 {id,title,toneClass,label}로 매핑해 받는다.

export type GridEvent = { id: string; title: string; toneClass: string; label: string };

const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];

type Cell = { dayNum: number; key: string; dow: number } | null;

export function MonthCalendar({
  year,
  monthIndex,
  weekKeys,
  eventsByDay,
  todayKey,
  prevHref,
  nextHref,
  label
}: {
  year: number;
  monthIndex: number; // 0-based (월간 모드용)
  weekKeys?: string[]; // 주간 모드: 그 주의 7개 KST 일자키(일~토). 있으면 주간 렌더.
  eventsByDay: Record<string, GridEvent[]>;
  todayKey: string;
  prevHref: string;
  nextHref: string;
  label: string;
}) {
  const pad = (n: number) => String(n).padStart(2, "0");
  const isWeek = Array.isArray(weekKeys) && weekKeys.length === 7;

  let cells: Cell[];
  if (isWeek) {
    cells = weekKeys!.map((key, i) => ({ dayNum: Number(key.slice(8, 10)), key, dow: i }));
  } else {
    const firstWeekday = new Date(year, monthIndex, 1).getDay();
    const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
    const totalCells = Math.ceil((firstWeekday + daysInMonth) / 7) * 7;
    cells = Array.from({ length: totalCells }, (_, i) => {
      const dayNum = i - firstWeekday + 1;
      if (dayNum < 1 || dayNum > daysInMonth) return null;
      return { dayNum, key: `${year}-${pad(monthIndex + 1)}-${pad(dayNum)}`, dow: i % 7 };
    });
  }

  const cellMin = isWeek ? "min-h-[160px]" : "min-h-[92px]";
  const maxEvents = isWeek ? 8 : 3;

  return (
    <div className="rounded-2xl border border-line bg-card p-4">
      <div className="mb-3 flex items-center justify-between">
        <a href={prevHref} className="rounded-lg border border-line px-2.5 py-1 text-sm text-slate-600 hover:bg-surface" aria-label={isWeek ? "이전 주" : "이전 달"}>‹</a>
        <p className="text-sm font-bold text-ink">{label}</p>
        <a href={nextHref} className="rounded-lg border border-line px-2.5 py-1 text-sm text-slate-600 hover:bg-surface" aria-label={isWeek ? "다음 주" : "다음 달"}>›</a>
      </div>

      <div className="grid grid-cols-7 border-l border-t border-line">
        {WEEKDAYS.map((w, i) => (
          <div key={w} className={`border-b border-r border-line bg-surface py-1.5 text-center text-xs font-semibold ${i === 0 ? "text-rose-500" : i === 6 ? "text-sky-500" : "text-slate-500"}`}>{w}</div>
        ))}
        {cells.map((cell, i) => (
          <div key={i} className={`${cellMin} border-b border-r border-line p-1.5 align-top ${cell?.key === todayKey ? "bg-brand/5" : "bg-card"}`}>
            {cell && (
              <>
                <div className={`mb-1 text-right text-xs font-medium ${cell.dow === 0 ? "text-rose-500" : cell.dow === 6 ? "text-sky-500" : "text-slate-500"} ${cell.key === todayKey ? "font-bold text-brand" : ""}`}>{cell.dayNum}</div>
                <div className="space-y-0.5">
                  {(eventsByDay[cell.key] ?? []).slice(0, maxEvents).map((e) => (
                    <div key={e.id} className={`truncate rounded border px-1 py-0.5 text-[10px] font-medium ${e.toneClass}`} title={`${e.label} · ${e.title}`}>{e.title}</div>
                  ))}
                  {(eventsByDay[cell.key] ?? []).length > maxEvents && <div className="pl-1 text-[10px] text-slate-400">+{(eventsByDay[cell.key] ?? []).length - maxEvents}건</div>}
                </div>
              </>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
