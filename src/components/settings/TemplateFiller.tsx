// 목표 경로: src/components/settings/TemplateFiller.tsx
//
// 서식 발급 — HR/일반 서식을 골라 {자리표시자}를 채우고 인쇄(PDF)한다.
// 인사 서식(근로계약서·재직증명서 등)의 사용처.
"use client";

import { useMemo, useState } from "react";
import { Printer } from "lucide-react";

type Template = { id: string; name: string; title: string; body: string };

// 본문에서 {자리표시자} 토큰을 추출.
function extractTokens(body: string): string[] {
  const set = new Set<string>();
  for (const m of body.matchAll(/\{([^}]+)\}/g)) set.add(m[1]);
  return [...set];
}

const inputCls = "mt-1 w-full rounded-md border border-line px-3 py-2 text-sm text-ink outline-none focus:border-brand";

export function TemplateFiller({ templates }: { templates: Template[] }) {
  const [selectedId, setSelectedId] = useState("");
  const [values, setValues] = useState<Record<string, string>>({});

  const selected = templates.find((t) => t.id === selectedId) ?? null;
  const tokens = useMemo(() => (selected ? extractTokens(selected.body) : []), [selected]);

  const filled = useMemo(() => {
    if (!selected) return "";
    let out = selected.body;
    for (const tk of tokens) out = out.replaceAll(`{${tk}}`, values[tk]?.trim() || `{${tk}}`);
    return out;
  }, [selected, tokens, values]);

  function print() {
    const w = window.open("", "_blank", "width=800,height=1000");
    if (!w) return;
    const safe = filled.replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[c] as string);
    w.document.write(
      `<html><head><title>${selected?.title ?? "문서"}</title><style>body{font-family:'Malgun Gothic',sans-serif;white-space:pre-wrap;line-height:1.8;padding:48px;font-size:13px;color:#1a1c20}</style></head><body>${safe}</body></html>`
    );
    w.document.close();
    w.focus();
    w.print();
  }

  if (templates.length === 0) {
    return <p className="text-sm text-slate-400">발급 가능한 서식이 없습니다. 위 ‘서식 관리’에서 인사/일반 서식을 추가하세요.</p>;
  }

  return (
    <div className="space-y-4">
      <label className="block max-w-md">
        <span className="text-xs font-semibold text-slate-500">서식 선택</span>
        <select value={selectedId} onChange={(e) => { setSelectedId(e.target.value); setValues({}); }} className={inputCls}>
          <option value="">선택</option>
          {templates.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
        </select>
      </label>

      {selected ? (
        <div className="grid gap-4 lg:grid-cols-2">
          {/* 자리표시자 입력 */}
          <div className="space-y-2 rounded-xl border border-line bg-white p-4">
            <p className="text-sm font-bold text-ink">항목 채우기</p>
            {tokens.length === 0 ? (
              <p className="text-xs text-slate-400">채울 항목이 없습니다.</p>
            ) : (
              tokens.map((tk) => (
                <label key={tk} className="block">
                  <span className="text-xs text-slate-500">{tk}</span>
                  <input value={values[tk] ?? ""} onChange={(e) => setValues({ ...values, [tk]: e.target.value })} className={inputCls} />
                </label>
              ))
            )}
            <button type="button" onClick={print} className="mt-2 inline-flex items-center gap-1.5 rounded-md bg-brand px-4 py-2 text-sm font-semibold text-white">
              <Printer className="h-4 w-4" /> 인쇄 / PDF
            </button>
          </div>

          {/* 미리보기 */}
          <div className="rounded-xl border border-line bg-surface/40 p-4">
            <p className="mb-2 text-sm font-bold text-ink">미리보기</p>
            <pre className="max-h-[420px] overflow-auto whitespace-pre-wrap font-sans text-xs leading-6 text-slate-700">{filled}</pre>
          </div>
        </div>
      ) : null}
    </div>
  );
}
