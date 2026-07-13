// 목표 경로: src/components/settings/TemplateFiller.tsx
//
// 서식 발급 — HR/일반 서식을 골라 {자리표시자}를 채우고 인쇄(PDF)한다.
// 회사 대표(김보형) 서명란에는 회사 도장(public/seal-venom.png)을 겹쳐 찍는다.
"use client";

import { useMemo, useState } from "react";
import { Printer } from "lucide-react";

type Template = { id: string; name: string; title: string; body: string };

const SEAL_SRC = "/seal-venom.png";
// 회사 대표명 — 이 이름이 있는 서명 라인에 회사 도장을 겹친다(상대방 서명란엔 찍지 않음).
const COMPANY_REP = "김보형";

// 본문에서 {자리표시자} 토큰을 추출.
function extractTokens(body: string): string[] {
  const set = new Set<string>();
  for (const m of body.matchAll(/\{([^}]+)\}/g)) set.add(m[1]);
  return [...set];
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[c] as string);
}

// 채워진 본문 → HTML. stamp=true면 회사 대표 서명 라인 끝에 도장 이미지를 겹친다.
function renderHtml(text: string, stamp: boolean): string {
  const sealTag =
    `<img src="${SEAL_SRC}" alt="주식회사 베놈 도장" ` +
    `style="height:58px;width:auto;margin-left:10px;vertical-align:middle;opacity:0.92" />`;
  return text
    .split("\n")
    .map((line) => {
      const esc = escapeHtml(line);
      return stamp && line.includes(COMPANY_REP) ? `${esc}${sealTag}` : esc;
    })
    .join("\n");
}

const inputCls = "mt-1 w-full rounded-md border border-line px-3 py-2 text-sm text-ink outline-none focus:border-brand";

export function TemplateFiller({ templates }: { templates: Template[] }) {
  const [selectedId, setSelectedId] = useState("");
  const [values, setValues] = useState<Record<string, string>>({});
  const [stamp, setStamp] = useState(true);

  const selected = templates.find((t) => t.id === selectedId) ?? null;
  const tokens = useMemo(() => (selected ? extractTokens(selected.body) : []), [selected]);

  const filled = useMemo(() => {
    if (!selected) return "";
    let out = selected.body;
    for (const tk of tokens) out = out.replaceAll(`{${tk}}`, values[tk]?.trim() || `{${tk}}`);
    return out;
  }, [selected, tokens, values]);

  // 도장 대상 서식인지(회사 대표 서명이 있는 문서). 임직원 서약서 등 본인 서명 문서엔 도장 없음.
  const hasSealTarget = filled.includes(COMPANY_REP);
  const previewHtml = useMemo(() => renderHtml(filled, stamp && hasSealTarget), [filled, stamp, hasSealTarget]);

  function print() {
    const w = window.open("", "_blank", "width=800,height=1000");
    if (!w) return;
    const body = renderHtml(filled, stamp && hasSealTarget);
    w.document.write(
      `<html><head><title>${escapeHtml(selected?.title ?? "문서")}</title>` +
        `<style>body{font-family:'Malgun Gothic',sans-serif;white-space:pre-wrap;line-height:1.9;padding:48px;font-size:13px;color:#1a1c20}img{page-break-inside:avoid}</style>` +
        `</head><body>${body}</body></html>`
    );
    w.document.close();
    w.focus();
    // 이미지(도장) 로딩 후 인쇄 — 로드 완료를 기다림.
    setTimeout(() => w.print(), 300);
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
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {/* 자리표시자 입력 */}
          <div className="space-y-2 rounded-2xl border border-line bg-white p-4">
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
            <div className="mt-2 flex items-center justify-between gap-2">
              <label className={`inline-flex items-center gap-1.5 text-xs ${hasSealTarget ? "text-slate-600" : "text-slate-300"}`}>
                <input type="checkbox" checked={stamp} disabled={!hasSealTarget} onChange={(e) => setStamp(e.target.checked)} />
                회사 도장 {hasSealTarget ? "" : "(해당 없음)"}
              </label>
              <button type="button" onClick={print} className="inline-flex items-center gap-1.5 rounded-md bg-brand px-4 py-2 text-sm font-semibold text-white">
                <Printer className="h-4 w-4" /> 인쇄 / PDF
              </button>
            </div>
          </div>

          {/* 미리보기 */}
          <div className="rounded-xl border border-line bg-surface/40 p-4">
            <p className="mb-2 text-sm font-bold text-ink">미리보기</p>
            <div
              className="max-h-[420px] overflow-auto whitespace-pre-wrap font-sans text-xs leading-6 text-slate-700"
              dangerouslySetInnerHTML={{ __html: previewHtml }}
            />
          </div>
        </div>
      ) : null}
    </div>
  );
}
