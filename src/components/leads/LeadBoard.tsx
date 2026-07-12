// 목표 경로: src/components/leads/LeadBoard.tsx
//
// 리드 파이프라인 보드 — 활성 5단계 컬럼(WorkBoard와 동일한 버튼 전이 패턴).
// 종결(WON/LOST)·재접촉은 컬럼으로 펴지 않고 요약칩으로 표시(패널 결정 #2).
import Link from "next/link";
import { ACTIVE_LEAD_STAGES, leadStatusLabels } from "@/domain/sales/lead-stages";
import type { LeadListItem } from "@/server/repositories/leads";
import { LeadStatusButtons } from "@/components/leads/LeadStatusButtons";

const dateFmt = new Intl.DateTimeFormat("ko-KR", { month: "numeric", day: "numeric" });

function Card({ item }: { item: LeadListItem }) {
  return (
    <div className="rounded-xl border border-line bg-card p-3 shadow-sm transition-shadow hover:shadow-md">
      <Link href={`/leads/${item.id}`} className="text-sm font-semibold text-ink hover:underline">
        {item.hospitalName}
      </Link>
      <p className="mt-0.5 text-[11px] text-slate-400">
        {[item.department, item.region].filter(Boolean).join(" · ") || "정보 없음"}
      </p>
      <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-500">
        {item.grade ? (
          <span className="rounded bg-surface px-1.5 py-0.5 text-[11px] font-bold text-slate-600">{item.grade}등급</span>
        ) : null}
        {item.assigneeName ? <span>{item.assigneeName}</span> : <span className="text-slate-400">미배정</span>}
        {item.auditScore !== null ? <span>· 진단 {item.auditScore}점</span> : null}
        {item.nextActionAt ? <span>· 다음 {dateFmt.format(new Date(item.nextActionAt))}</span> : null}
      </div>
      <div className="mt-2 border-t border-line pt-2">
        <LeadStatusButtons leadId={item.id} status={item.status} compact />
      </div>
    </div>
  );
}

export function LeadBoard({ items }: { items: LeadListItem[] }) {
  const byStatus = new Map<string, LeadListItem[]>();
  for (const col of ACTIVE_LEAD_STAGES) byStatus.set(col, []);
  for (const item of items) {
    const bucket = byStatus.get(item.status);
    if (bucket) bucket.push(item);
  }

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
      {ACTIVE_LEAD_STAGES.map((col) => {
        const cards = byStatus.get(col) ?? [];
        return (
          <div key={col} className="rounded-2xl border border-line bg-surface/50 p-2">
            <div className="flex items-center justify-between px-1.5 pb-2 pt-1">
              <span className="text-xs font-bold text-slate-600">{leadStatusLabels[col]}</span>
              <span
                className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${
                  cards.length > 0 ? "bg-emerald-50 text-emerald-700" : "bg-card text-slate-400"
                }`}
              >
                {cards.length}
              </span>
            </div>
            <div className="space-y-2">
              {cards.length === 0 ? (
                <p className="px-1 py-4 text-center text-[11px] text-slate-400">비어 있음</p>
              ) : (
                cards.map((item) => <Card key={item.id} item={item} />)
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
