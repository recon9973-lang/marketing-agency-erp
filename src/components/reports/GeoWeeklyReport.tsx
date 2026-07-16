// 목표 경로: src/components/reports/GeoWeeklyReport.tsx
//
// 거래처 GEO 주간 리포트 렌더러 — M3 assembleGeoWeekly/buildGeoWeekly 결과(GeoWeeklyReport)를
// 주 라벨 + 요약 + 성과(keyWins)/리스크(risks)/다음 액션(nextActions) 3개 리스트로 표시한다.
// 파생·비영속 리포트(Report 행 없음) — 스키마 변경 0. 서버 컴포넌트(비인터랙티브).
// GEO emerald 액센트 + 기존 토큰(brand/amber)만, 신규 디자인 토큰 없음.
import type { GeoWeeklyReport as GeoWeekly } from "@/server/marketing/geo-weekly";

type Tone = "win" | "risk" | "action";

const TONE: Record<Tone, { dot: string; text: string; heading: string }> = {
  win: { dot: "bg-emerald-600", text: "text-slate-700", heading: "text-emerald-700" },
  risk: { dot: "bg-amber-500", text: "text-slate-700", heading: "text-amber-600" },
  action: { dot: "bg-brand", text: "text-slate-700", heading: "text-brand-strong" }
};

function Section({ label, items, tone }: { label: string; items: string[]; tone: Tone }) {
  const t = TONE[tone];
  return (
    <div className="rounded-xl border border-line bg-surface/40 p-3">
      <p className={`text-xs font-bold ${t.heading}`}>{label}</p>
      {items.length === 0 ? (
        <p className="mt-1.5 text-[11px] text-slate-400">해당 없음</p>
      ) : (
        <ul className="mt-1.5 space-y-1">
          {items.map((it, i) => (
            <li key={i} className="flex items-start gap-2 text-[12px]">
              <span className={`mt-1.5 inline-block h-1.5 w-1.5 shrink-0 rounded-full ${t.dot}`} aria-hidden="true" />
              <span className={t.text}>{it}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function GeoWeeklyReport({ report }: { report: GeoWeekly }) {
  return (
    <article className="rounded-2xl border border-line bg-card p-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded-md bg-emerald-50 px-2 py-0.5 text-xs font-bold text-emerald-700">{report.weekLabel}</span>
        <span className="text-sm font-semibold text-ink">{report.clientName}</span>
        <span className="text-[11px] text-slate-400">GEO 주간 리포트 · 규칙기반 파생(비영속)</span>
      </div>

      <p className="mt-2 text-sm font-medium text-ink">{report.summary}</p>

      <div className="mt-3 grid gap-2 md:grid-cols-3">
        <Section label="이번 주 성과" items={report.keyWins} tone="win" />
        <Section label="리스크" items={report.risks} tone="risk" />
        <Section label="다음 액션" items={report.nextActions} tone="action" />
      </div>
    </article>
  );
}
