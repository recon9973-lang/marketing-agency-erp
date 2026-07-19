// 거래처 여정 타임라인 — 8단계 마일스톤을 시간순으로(파이프라인 가시성). 서버 컴포넌트.
import type { JourneyEvent } from "@/server/repositories/journey";

const dateFmt = new Intl.DateTimeFormat("ko-KR", { dateStyle: "medium" });

// 단계별 색(리드 1~4 = 쿨톤 → 거래처 5~8 = 브랜드톤).
const STAGE_TONE: Record<number, string> = {
  1: "bg-slate-400",
  2: "bg-sky-500",
  3: "bg-indigo-500",
  4: "bg-violet-500",
  5: "bg-brand",
  6: "bg-amber-500",
  7: "bg-orange-500",
  8: "bg-emerald-500"
};

export function ClientJourney({ events }: { events: JourneyEvent[] }) {
  if (events.length === 0) {
    return (
      <div className="rounded-2xl border border-line bg-card p-4">
        <p className="text-sm font-bold text-ink">거래처 여정</p>
        <p className="mt-2 rounded-xl border border-dashed border-line bg-surface/50 px-4 py-6 text-center text-sm text-slate-500">
          진행 기록이 쌓이면 상담→계약→콘텐츠 여정이 시간순으로 표시됩니다.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-line bg-card p-4">
      <div className="mb-3 flex items-center gap-2">
        <p className="text-sm font-bold text-ink">거래처 여정</p>
        <span className="text-[11px] text-slate-400">상담 → 컨설팅 → 미팅 → 계약 → 배정 → 키워드 → GEO → 콘텐츠 · {events.length}개 기록</span>
      </div>
      <ol className="relative ml-1 border-l border-line">
        {events.map((e, i) => (
          <li key={i} className="mb-4 ml-4 last:mb-0">
            <span className={`absolute -left-[6.5px] mt-1 h-3 w-3 rounded-full ring-2 ring-card ${STAGE_TONE[e.stage] ?? "bg-slate-400"}`} aria-hidden="true" />
            <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
              <span className="font-mono text-[10px] font-bold text-slate-400">{e.stage}. {e.label}</span>
              <span className="text-sm font-semibold text-ink">{e.title}</span>
            </div>
            <div className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-slate-500">
              <span className="tabular-nums">{e.date ? dateFmt.format(new Date(e.date)) : "일자 미상"}</span>
              {e.sub ? <span className="text-slate-400">· {e.sub}</span> : null}
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}
