"use client";

// GEO Studio M3 — 저장된 콘텐츠 진단 목록(본인). 재작성안 열람 + 삭제.
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { deleteContentDiagnosis } from "@/server/actions/geo-content";

type SavedDiagnosis = { id: string; keyword: string; contentPreview: string; scoreTotal: number; rewrite: string; createdAt: string };

function scoreTone(n: number): string {
  return n >= 70 ? "text-emerald-600" : n >= 40 ? "text-amber-600" : "text-rose-600";
}

export function SavedContentDiagnoses({ items }: { items: SavedDiagnosis[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [openId, setOpenId] = useState<string | null>(null);

  function remove(id: string) {
    if (!confirm("이 진단 기록을 삭제할까요?")) return;
    start(async () => {
      await deleteContentDiagnosis({ id });
      router.refresh();
    });
  }

  if (items.length === 0) {
    return (
      <p className="rounded-xl border border-dashed border-line bg-surface/40 px-4 py-6 text-center text-sm text-slate-400">
        저장된 진단이 없습니다. 분석 후 <b>진단 저장</b>을 누르면 점수·재작성안이 여기에 보관됩니다.
      </p>
    );
  }

  return (
    <ul className="space-y-2">
      {items.map((d) => (
        <li key={d.id} className="rounded-lg border border-line bg-white p-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className={`text-lg font-bold tabular-nums ${scoreTone(d.scoreTotal)}`}>{d.scoreTotal}</span>
            <span className="text-sm font-semibold text-ink">{d.keyword || "(키워드 없음)"}</span>
            <span className="truncate text-xs text-slate-400" title={d.contentPreview}>{d.contentPreview.slice(0, 40)}…</span>
            <span className="text-[11px] text-slate-400">{d.createdAt.slice(0, 10)}</span>
            <div className="ml-auto flex items-center gap-1.5">
              <button type="button" onClick={() => setOpenId(openId === d.id ? null : d.id)} className="rounded-md border border-line px-2 py-1 text-xs text-slate-600 hover:bg-surface">
                {openId === d.id ? "재작성안 닫기" : "재작성안"}
              </button>
              <button type="button" onClick={() => remove(d.id)} disabled={pending} className="text-slate-400 hover:text-danger disabled:opacity-50" aria-label="삭제">
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          </div>
          {openId === d.id && (
            <pre className="mt-3 max-h-96 overflow-auto whitespace-pre-wrap border-t border-line pt-3 text-xs leading-relaxed text-slate-700">{d.rewrite || "(재작성안 없음)"}</pre>
          )}
        </li>
      ))}
    </ul>
  );
}
