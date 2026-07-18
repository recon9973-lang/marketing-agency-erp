// 주간 타임그리드 캘린더 — 서버 렌더(순수). 요일 컬럼 × 시간대 행에 일정을 시간 블록으로 배치.
// 겹치는 일정은 나란히(lane) 분할, 현재시각 표시선, 주말 음영, 빈 주 안내까지 처리.
// 이벤트는 페이지에서 KST 분(startMin/endMin) + 색상으로 선매핑해 받는다.

export type WeekEvent = { id: string; dayKey: string; startMin: number; endMin: number; title: string; toneClass: string; label: string; timeLabel: string };

const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];
const HOUR_H = 44; // 시간당 픽셀
const GUTTER = 48; // 시간 눈금 열 너비(px)

/** 하루 안에서 겹치는 이벤트를 lane(열)으로 나눠 나란히 배치. */
function assignLanes(events: WeekEvent[]): Array<WeekEvent & { lane: number; lanes: number }> {
  const sorted = [...events].sort((a, b) => a.startMin - b.startMin || a.endMin - b.endMin);
  const laneEnd: number[] = []; // 각 lane의 마지막 종료분
  const placed = sorted.map((e) => {
    let lane = laneEnd.findIndex((end) => end <= e.startMin);
    if (lane === -1) {
      lane = laneEnd.length;
      laneEnd.push(e.endMin);
    } else {
      laneEnd[lane] = e.endMin;
    }
    return { ...e, lane, lanes: 1 };
  });
  // 서로 겹치는 그룹의 최대 lane 수를 폭 계산에 반영.
  for (const e of placed) {
    const overlap = placed.filter((o) => o.startMin < e.endMin && o.endMin > e.startMin);
    const lanes = Math.max(...overlap.map((o) => o.lane)) + 1;
    for (const o of overlap) o.lanes = Math.max(o.lanes, lanes);
  }
  return placed;
}

export function WeekCalendar({
  weekDays,
  events,
  todayKey,
  nowMin,
  prevHref,
  nextHref,
  todayHref,
  label
}: {
  weekDays: string[]; // 7개 KST 일자키(일~토)
  events: WeekEvent[];
  todayKey: string;
  nowMin: number; // 서버 렌더 시점 KST 분(현재시각선)
  prevHref: string;
  nextHref: string;
  todayHref: string;
  label: string;
}) {
  // 표시 시간대: 이벤트 범위를 감싸되 최소 08~20시. 현재시각도 포함.
  const startHours = events.map((e) => Math.floor(e.startMin / 60));
  const endHours = events.map((e) => Math.ceil(e.endMin / 60));
  const dayStart = Math.max(0, Math.min(8, Math.floor(nowMin / 60), ...(startHours.length ? startHours : [8])));
  const dayEnd = Math.min(24, Math.max(20, Math.ceil(nowMin / 60) + 1, ...(endHours.length ? endHours : [20])));
  const hours = Array.from({ length: dayEnd - dayStart }, (_, i) => dayStart + i);
  const gridH = (dayEnd - dayStart) * HOUR_H;
  const top = (min: number) => ((min - dayStart * 60) / 60) * HOUR_H;

  const cols = `${GUTTER}px repeat(7, minmax(0, 1fr))`;

  return (
    <div className="rounded-2xl border border-line bg-card p-4">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <a href={prevHref} className="rounded-lg border border-line px-2.5 py-1 text-sm text-slate-600 hover:bg-surface" aria-label="이전 주">‹</a>
          <a href={todayHref} className="rounded-lg border border-line px-2.5 py-1 text-xs font-medium text-slate-600 hover:bg-surface">오늘</a>
          <a href={nextHref} className="rounded-lg border border-line px-2.5 py-1 text-sm text-slate-600 hover:bg-surface" aria-label="다음 주">›</a>
        </div>
        <p className="text-sm font-bold text-ink">{label}</p>
        <span className="text-xs text-slate-400">{events.length}건</span>
      </div>

      {/* 요일 헤더 */}
      <div className="grid" style={{ gridTemplateColumns: cols }}>
        <div />
        {weekDays.map((key, i) => {
          const isToday = key === todayKey;
          return (
            <div key={key} className={`pb-1.5 text-center ${i > 0 ? "border-l border-line" : ""}`}>
              <div className={`text-[11px] font-semibold ${i === 0 ? "text-rose-500" : i === 6 ? "text-sky-500" : "text-slate-500"}`}>{WEEKDAYS[i]}</div>
              <div className={`mx-auto mt-0.5 flex h-6 w-6 items-center justify-center rounded-full text-sm font-bold ${isToday ? "bg-brand text-white" : "text-ink"}`}>{Number(key.slice(8, 10))}</div>
            </div>
          );
        })}
      </div>

      {/* 타임그리드 */}
      <div className="relative grid border-t border-line" style={{ gridTemplateColumns: cols }}>
        {/* 시간 눈금 */}
        <div className="relative" style={{ height: gridH }}>
          {hours.map((h, i) => (
            <div key={h} className="absolute right-1.5 text-[10px] tabular-nums text-slate-400" style={{ top: i * HOUR_H - 4 }}>{String(h).padStart(2, "0")}:00</div>
          ))}
        </div>
        {/* 요일별 컬럼 */}
        {weekDays.map((key, di) => {
          const dayEvents = assignLanes(events.filter((e) => e.dayKey === key));
          const weekendTint = di === 0 ? "bg-rose-50/30" : di === 6 ? "bg-sky-50/30" : "";
          const isToday = key === todayKey;
          return (
            <div key={key} className={`relative border-l border-line ${isToday ? "bg-brand/5" : weekendTint}`} style={{ height: gridH }}>
              {hours.map((h, i) => (
                <div key={h} className="absolute inset-x-0 border-t border-line/50" style={{ top: i * HOUR_H }} />
              ))}
              {/* 현재시각선 */}
              {isToday && nowMin >= dayStart * 60 && nowMin <= dayEnd * 60 && (
                <div className="absolute inset-x-0 z-10 border-t-2 border-rose-500" style={{ top: top(nowMin) }}>
                  <span className="absolute -left-0.5 -top-1 h-2 w-2 rounded-full bg-rose-500" />
                </div>
              )}
              {dayEvents.map((e) => {
                const t = Math.max(0, top(e.startMin));
                const h = Math.max(20, top(e.endMin) - top(e.startMin));
                const w = 100 / e.lanes;
                return (
                  <div
                    key={e.id}
                    className={`absolute overflow-hidden rounded border px-1 py-0.5 text-[10px] leading-tight ${e.toneClass}`}
                    style={{ top: t, height: h, left: `calc(${e.lane * w}% + 1px)`, width: `calc(${w}% - 2px)` }}
                    title={`${e.label} · ${e.timeLabel} · ${e.title}`}
                  >
                    <span className="block truncate font-semibold">{e.title}</span>
                    {h >= 34 && <span className="block truncate opacity-70">{e.timeLabel}</span>}
                  </div>
                );
              })}
            </div>
          );
        })}

        {events.length === 0 && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <p className="rounded-lg bg-surface/80 px-3 py-1.5 text-xs text-slate-400">이번 주 일정이 없습니다 · ‹ › 로 다른 주 보기</p>
          </div>
        )}
      </div>
    </div>
  );
}
