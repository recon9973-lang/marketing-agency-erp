// 목표 경로: src/components/clients/ConsultingPanel.tsx
//
// 영업 컨설팅 패널 — 병원 정보로 키워드·경쟁·상권 분석(Claude) 생성.
"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { FileDown, Sparkles } from "lucide-react";
import { runConsulting } from "@/server/actions/consulting";
import { QuotePanel } from "@/components/clients/QuotePanel";
import { printDocument, escapeHtml } from "@/lib/print-doc";

type KeywordRow = { keyword: string; intent: string; priority: number; channel: string; searchVolume?: number | null; estimated?: boolean };
const volFmt = new Intl.NumberFormat("ko-KR");
type Report = {
  id: string;
  hospitalName: string;
  keywords: KeywordRow[];
  competitors: string | null;
  marketAnalysis: string | null;
  summary: string | null;
  createdAt: string;
} | null;

const CHANNEL_LABEL: Record<string, string> = { blog: "블로그", place: "플레이스", powerlink: "파워링크", seo: "SEO", geo: "GEO", aeo: "AEO" };
const inputCls = "mt-1 w-full rounded-md border border-line px-3 py-2 text-sm text-ink outline-none focus:border-brand";
const dateFmt = new Intl.DateTimeFormat("ko-KR", { dateStyle: "medium", timeStyle: "short" });

type QuoteRow = { id: string; tier: string; items: { productId: string | null; name: string; monthlyFee: number; quantity: number }[]; monthlyTotal: number; status: string; createdAt: string };

export function ConsultingPanel({
  clientId,
  aiConfigured,
  defaults,
  report,
  quotes,
  canRun
}: {
  clientId: string;
  aiConfigured: boolean;
  defaults: { hospitalName: string; address: string; departments: string };
  report: Report;
  quotes: QuoteRow[];
  canRun: boolean;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({ ...defaults, competitors: "" });

  function exportReport(r: NonNullable<Report>) {
    const kwRows = r.keywords.map((k) => `<tr><td>${escapeHtml(k.keyword)}</td><td>${escapeHtml(k.intent)}</td><td>${escapeHtml(CHANNEL_LABEL[k.channel] ?? k.channel)}</td><td>${k.priority}</td></tr>`).join("");
    const html = `
      <p class="eyebrow">컨설팅 리포트 · 주식회사 베놈</p>
      <h1>${escapeHtml(r.hospitalName)}</h1>
      ${r.summary ? `<p>${escapeHtml(r.summary)}</p>` : ""}
      <h2>핵심 키워드 (${r.keywords.length})</h2>
      <table><thead><tr><th>키워드</th><th>의도</th><th>채널</th><th>우선</th></tr></thead><tbody>${kwRows}</tbody></table>
      ${r.competitors ? `<h2>경쟁 병원 분석</h2><div>${escapeHtml(r.competitors)}</div>` : ""}
      ${r.marketAnalysis ? `<h2>상권 분석</h2><div>${escapeHtml(r.marketAnalysis)}</div>` : ""}
    `;
    printDocument(`${r.hospitalName} 컨설팅 리포트`, html);
  }

  function run() {
    setError(null);
    if (!form.hospitalName.trim()) return setError("병원명을 입력하세요.");
    start(async () => {
      const res = await runConsulting({ clientId, ...form });
      if (!res.ok) {
        setError(res.error === "AI_NOT_CONFIGURED" ? "AI 엔진이 연결되지 않았습니다(연동에서 ANTHROPIC_API_KEY)." : "컨설팅 생성에 실패했습니다.");
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="space-y-5">
      {!aiConfigured ? (
        <div className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          AI 엔진이 아직 연결되지 않았습니다. 연동 화면에서 <code className="rounded bg-white px-1 font-mono text-[11px]">ANTHROPIC_API_KEY</code>를 넣으면 켜집니다.
        </div>
      ) : null}

      {canRun ? (
        <div className="rounded-2xl border border-line bg-white p-4">
          <p className="text-sm font-bold text-ink">컨설팅 분석 생성</p>
          <p className="mt-1 text-xs text-slate-500">병원 정보를 입력하면 핵심 키워드·경쟁·상권 분석 초안을 만듭니다. (사람이 검토 후 거래처에 공유)</p>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <label className="block"><span className="text-xs font-semibold text-slate-500">병원명 *</span>
              <input value={form.hospitalName} onChange={(e) => setForm({ ...form, hospitalName: e.target.value })} className={inputCls} /></label>
            <label className="block"><span className="text-xs font-semibold text-slate-500">주소</span>
              <input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} placeholder="예: 대구 수성구" className={inputCls} /></label>
            <label className="block"><span className="text-xs font-semibold text-slate-500">진료과목</span>
              <input value={form.departments} onChange={(e) => setForm({ ...form, departments: e.target.value })} placeholder="예: 피부과, 성형외과" className={inputCls} /></label>
            <label className="block"><span className="text-xs font-semibold text-slate-500">경쟁 병원(선택)</span>
              <input value={form.competitors} onChange={(e) => setForm({ ...form, competitors: e.target.value })} className={inputCls} /></label>
          </div>
          {error ? <p className="mt-2 text-sm text-danger">{error}</p> : null}
          <button type="button" onClick={run} disabled={pending || !aiConfigured} className="mt-3 inline-flex items-center gap-1.5 rounded-md bg-brand px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">
            <Sparkles className="h-4 w-4" /> {pending ? "분석 생성 중… (최대 1분)" : report ? "재분석" : "컨설팅 분석 생성"}
          </button>
        </div>
      ) : null}

      {report ? (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm font-bold text-ink">최신 컨설팅 리포트</p>
            <div className="flex items-center gap-2">
              <button type="button" onClick={() => exportReport(report)} className="inline-flex items-center gap-1 rounded-md border border-line px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-surface">
                <FileDown className="h-3.5 w-3.5" /> PDF
              </button>
              <span className="text-xs text-slate-400">{dateFmt.format(new Date(report.createdAt))}</span>
            </div>
          </div>

          {report.summary ? <p className="rounded-lg border border-line bg-surface/40 p-3 text-sm leading-6 text-slate-700">{report.summary}</p> : null}

          <div>
            <p className="mb-1.5 text-xs font-bold text-slate-500">핵심 키워드 ({report.keywords.length})</p>
            <div className="overflow-x-auto rounded-lg border border-line">
              <table className="w-full min-w-[480px] text-sm">
                <thead><tr className="border-b border-line bg-surface/40 text-left text-xs text-slate-500">
                  <th className="px-3 py-2">키워드</th><th className="px-3 py-2">의도</th><th className="px-3 py-2">채널</th><th className="px-3 py-2 text-right">월 검색량</th><th className="px-3 py-2 text-center">우선</th>
                </tr></thead>
                <tbody>
                  {report.keywords.map((k, i) => (
                    <tr key={i} className="border-b border-line/60 last:border-0">
                      <td className="px-3 py-1.5 font-medium text-ink">{k.keyword}</td>
                      <td className="px-3 py-1.5 text-slate-500">{k.intent}</td>
                      <td className="px-3 py-1.5"><span className="rounded-full bg-brand-soft px-2 py-0.5 text-xs text-brand-strong">{CHANNEL_LABEL[k.channel] ?? k.channel}</span></td>
                      <td className="px-3 py-1.5 text-right text-slate-600">
                        {k.searchVolume != null ? (
                          <span>{volFmt.format(k.searchVolume)}{k.estimated ? <span className="ml-0.5 text-[10px] text-slate-400">추정</span> : null}</span>
                        ) : <span className="text-slate-300">-</span>}
                      </td>
                      <td className="px-3 py-1.5 text-center text-slate-600">{k.priority}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {report.competitors ? (
              <div className="rounded-lg border border-line bg-white p-3">
                <p className="mb-1 text-xs font-bold text-slate-500">경쟁 병원 분석</p>
                <p className="whitespace-pre-wrap text-sm leading-6 text-slate-700">{report.competitors}</p>
              </div>
            ) : null}
            {report.marketAnalysis ? (
              <div className="rounded-lg border border-line bg-white p-3">
                <p className="mb-1 text-xs font-bold text-slate-500">상권 분석</p>
                <p className="whitespace-pre-wrap text-sm leading-6 text-slate-700">{report.marketAnalysis}</p>
              </div>
            ) : null}
          </div>
        </div>
      ) : (
        <p className="rounded-xl border border-dashed border-line bg-surface/40 px-4 py-8 text-center text-sm text-slate-500">아직 컨설팅 리포트가 없습니다.</p>
      )}

      {/* 견적 3종 */}
      <div className="border-t border-line pt-5">
        <p className="mb-3 text-sm font-bold text-ink">가격대별 견적 (3종)</p>
        <QuotePanel clientId={clientId} quotes={quotes} canManage={canRun} />
      </div>
    </div>
  );
}
