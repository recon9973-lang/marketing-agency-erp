// 목표 경로: src/components/leads/LeadAuditPanel.tsx
//
// 무료진단 패널 — §11 초기진단 8항목 체크리스트 + 자동 점수 + 브리핑 메모.
// 점수는 서버(computeAuditScore)에서 산정. 저장 후 새로고침으로 반영.
"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { saveLeadAudit } from "@/server/actions/leads";
import { AUDIT_CHECKLIST_ITEMS, computeAuditScore, type AuditChecklist } from "@/domain/sales/lead-stages";

export function LeadAuditPanel({
  leadId,
  initialChecklist,
  initialScore,
  initialNote
}: {
  leadId: string;
  initialChecklist: Record<string, boolean>;
  initialScore: number | null;
  initialNote: string | null;
}) {
  const router = useRouter();
  const [checklist, setChecklist] = useState<Record<string, boolean>>(initialChecklist);
  const [note, setNote] = useState(initialNote ?? "");
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [savedScore, setSavedScore] = useState<number | null>(initialScore);

  const liveScore = useMemo(() => computeAuditScore(checklist as AuditChecklist), [checklist]);

  function toggle(key: string) {
    setChecklist((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  function save() {
    setError(null);
    start(async () => {
      const res = await saveLeadAudit({ id: leadId, checklist, auditNote: note || null });
      if (!res.ok) setError(res.error);
      else {
        setSavedScore(res.data?.score ?? liveScore);
        router.refresh();
      }
    });
  }

  return (
    <div className="rounded-xl border border-line bg-panel p-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-bold text-ink">무료진단 체크리스트</h2>
        <div className="text-right">
          <span className="text-2xl font-bold text-ink">{liveScore}</span>
          <span className="text-xs text-slate-400"> /100점</span>
          {savedScore !== null && savedScore !== liveScore && (
            <p className="text-[10px] text-amber-600">저장된 점수 {savedScore}점 — 저장 필요</p>
          )}
        </div>
      </div>
      <ul className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
        {AUDIT_CHECKLIST_ITEMS.map((item) => (
          <li key={item.key}>
            <label className="flex items-center gap-2 rounded-lg border border-line bg-white px-3 py-2 text-sm text-slate-700">
              <input type="checkbox" checked={checklist[item.key] === true} onChange={() => toggle(item.key)} />
              {item.label}
            </label>
          </li>
        ))}
      </ul>
      <label className="mt-3 block text-xs font-medium text-slate-600">
        브리핑 메모 (문제 3개 · 기회 3개 — 15분 브리핑 자료)
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={4}
          maxLength={4000}
          className="mt-1 w-full rounded-md border border-line bg-white px-2.5 py-1.5 text-sm text-ink"
          placeholder={"문제: ①색인 누락 ②메타 중복 ③CTA 부재\n기회: ①진료과 랜딩 ②FAQ 구조화 ③플레이스 연동"}
        />
      </label>
      {error && <p className="mt-2 text-xs text-rose-600">{error}</p>}
      <button
        onClick={save}
        disabled={pending}
        className="mt-3 rounded-md bg-blue-600 px-4 py-1.5 text-sm font-semibold text-white disabled:opacity-50"
      >
        {pending ? "저장 중…" : "진단 저장"}
      </button>
    </div>
  );
}
