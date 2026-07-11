// 목표 경로: src/components/compliance/MedicalLawChecker.tsx
//
// 의료법 검수 도구 — 원고를 붙여넣고 위험 표현을 표시. AI가 아닌 규칙엔진 1차 필터.
"use client";

import { useState, useTransition } from "react";
import { ShieldAlert, ShieldCheck } from "lucide-react";
import { checkContentCompliance } from "@/server/actions/compliance";

type Flag = { type: string; label: string; code: number; severity: "high" | "medium"; matched: string };
type Result = { flags: Flag[]; highCount: number; mediumCount: number };

const inputCls = "w-full rounded-md border border-line px-3 py-2 text-sm text-ink outline-none focus:border-brand";

function escapeHtml(s: string) {
  return s.replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[c] as string);
}

// 검출된 표현을 하이라이트한 HTML을 만든다.
function highlight(text: string, flags: Flag[]): string {
  const terms = [...new Set(flags.map((f) => f.matched))].filter(Boolean).sort((a, b) => b.length - a.length);
  if (terms.length === 0) return escapeHtml(text);
  const re = new RegExp(`(${terms.map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})`, "gi");
  return escapeHtml(text).replace(
    new RegExp(re.source, "gi"),
    (m) => `<mark class="rounded bg-rose-100 px-0.5 text-rose-700">${m}</mark>`
  );
}

export function MedicalLawChecker({ clients }: { clients: { id: string; name: string }[] }) {
  const [text, setText] = useState("");
  const [clientId, setClientId] = useState("");
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function run() {
    setError(null);
    if (!text.trim()) {
      setError("검수할 원고를 입력하세요.");
      return;
    }
    start(async () => {
      const res = await checkContentCompliance({ text, clientId: clientId || null });
      if (!res.ok || !res.data) {
        setError("검수에 실패했습니다.");
        return;
      }
      setResult(res.data);
    });
  }

  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
      {/* 입력 */}
      <div className="space-y-3">
        <label className="block">
          <span className="text-xs font-semibold text-slate-500">거래처(선택 — 병원 금지어 함께 검사)</span>
          <select value={clientId} onChange={(e) => setClientId(e.target.value)} className={`mt-1 ${inputCls}`}>
            <option value="">미지정</option>
            {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </label>
        <label className="block">
          <span className="text-xs font-semibold text-slate-500">원고 *</span>
          <textarea value={text} onChange={(e) => setText(e.target.value)} rows={14} placeholder="블로그 원고·광고 카피를 붙여넣으세요." className={`mt-1 ${inputCls} resize-y`} />
        </label>
        {error ? <p className="text-sm text-danger">{error}</p> : null}
        <button type="button" onClick={run} disabled={pending} className="inline-flex items-center gap-1.5 rounded-md bg-brand px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">
          <ShieldAlert className="h-4 w-4" /> {pending ? "검수 중…" : "의료법 검수"}
        </button>
      </div>

      {/* 결과 */}
      <div className="space-y-3">
        {result === null ? (
          <p className="flex h-full min-h-[200px] items-center justify-center rounded-xl border border-dashed border-line bg-surface/40 text-sm text-slate-400">검수 결과가 여기 표시됩니다.</p>
        ) : result.flags.length === 0 ? (
          <div className="flex items-center gap-2 rounded-xl border border-emerald-300 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
            <ShieldCheck className="h-5 w-5" /> 규칙엔진에서 감지된 위험 표현이 없습니다. (최종 승인은 사람이 확인하세요)
          </div>
        ) : (
          <>
            <div className="flex gap-2">
              <span className="rounded-md bg-rose-50 px-2.5 py-1 text-xs font-bold text-rose-600">높음 {result.highCount}</span>
              <span className="rounded-md bg-amber-50 px-2.5 py-1 text-xs font-bold text-amber-600">보통 {result.mediumCount}</span>
            </div>
            <ul className="space-y-1.5">
              {result.flags.map((f, i) => (
                <li key={i} className="flex items-center gap-2 rounded-lg border border-line bg-white px-3 py-2 text-sm">
                  <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${f.severity === "high" ? "bg-rose-500" : "bg-amber-500"}`} />
                  <span className="font-mono text-rose-700">{f.matched}</span>
                  <span className="ml-auto text-xs text-slate-500">{f.label}{f.code ? ` (§56-${f.code})` : ""}</span>
                </li>
              ))}
            </ul>
            <div className="rounded-2xl border border-line bg-white p-3">
              <p className="mb-1.5 text-xs font-bold text-slate-500">원고 미리보기(위험 표현 강조)</p>
              <div className="whitespace-pre-wrap text-sm leading-6 text-slate-700" dangerouslySetInnerHTML={{ __html: highlight(text, result.flags) }} />
            </div>
            <p className="text-xs text-slate-400">※ 규칙엔진은 위험 표시만 합니다. AI 자동 승인이 아니며, 최종 게시 판단은 담당자·관리자가 합니다.</p>
          </>
        )}
      </div>
    </div>
  );
}
