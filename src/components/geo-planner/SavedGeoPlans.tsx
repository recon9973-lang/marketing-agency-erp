"use client";

// GEO Studio M5 — 저장된 캠페인 계획 목록(본인). 리포트 열람 + 삭제.
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { deleteGeoCampaignPlan } from "@/server/actions/geo-planner";

type SavedPlan = { id: string; name: string; industry: string; goalType: string; budget: number; report: string; createdAt: string };

const GOAL_LABELS: Record<string, string> = {
  citation_rate: "AI 인용율",
  cep_coverage: "CEP 커버리지",
  ta_score: "Topical Authority",
  roi: "ROI"
};
const won = (n: number) => n.toLocaleString("ko-KR") + "원";

export function SavedGeoPlans({ plans }: { plans: SavedPlan[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [openId, setOpenId] = useState<string | null>(null);

  function remove(id: string, name: string) {
    if (!confirm(`"${name}" 계획을 삭제할까요?`)) return;
    start(async () => {
      await deleteGeoCampaignPlan({ id });
      router.refresh();
    });
  }

  if (plans.length === 0) {
    return (
      <p className="rounded-xl border border-dashed border-line bg-surface/40 px-4 py-6 text-center text-sm text-slate-400">
        저장된 계획이 없습니다. 계획 생성 후 <b>계획 저장</b>을 누르면 여기에 보관됩니다.
      </p>
    );
  }

  return (
    <ul className="space-y-2">
      {plans.map((p) => (
        <li key={p.id} className="rounded-lg border border-line bg-white p-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-semibold text-ink">{p.name}</span>
            <span className="rounded-full bg-brand-soft px-2 py-0.5 text-[11px] text-brand-strong">{GOAL_LABELS[p.goalType] ?? p.goalType}</span>
            <span className="text-xs text-slate-400">{p.industry} · 예산 {won(p.budget)} · {p.createdAt.slice(0, 10)}</span>
            <div className="ml-auto flex items-center gap-1.5">
              <button type="button" onClick={() => setOpenId(openId === p.id ? null : p.id)} className="rounded-md border border-line px-2 py-1 text-xs text-slate-600 hover:bg-surface">
                {openId === p.id ? "리포트 닫기" : "리포트 보기"}
              </button>
              <button type="button" onClick={() => remove(p.id, p.name)} disabled={pending} className="text-slate-400 hover:text-danger disabled:opacity-50" aria-label="삭제">
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          </div>
          {openId === p.id && (
            <pre className="mt-3 max-h-96 overflow-auto whitespace-pre-wrap border-t border-line pt-3 text-xs leading-relaxed text-slate-700">{p.report}</pre>
          )}
        </li>
      ))}
    </ul>
  );
}
