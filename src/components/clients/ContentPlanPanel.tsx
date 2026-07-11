// 목표 경로: src/components/clients/ContentPlanPanel.tsx
//
// 콘텐츠 기획 — 주제 등록(선택 AI 초안) + 의료법 위험 표시 + 상태 전이.
"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, ShieldCheck, Sparkles, Trash2 } from "lucide-react";
import { createContentPlan, updateContentPlanStatus, deleteContentPlan } from "@/server/actions/content-plans";
import { requestApproval } from "@/server/actions/approvals";

type Flag = { label: string; matched: string; code: number; severity: string };
type Plan = {
  id: string;
  month: string;
  topic: string;
  keyword: string | null;
  angle: string | null;
  faq: string[];
  qa: { q: string; a: string }[];
  complianceRisk: { high: number; medium: number; flags: Flag[] } | null;
  status: string;
  createdAt: string;
};

const STATUSES = ["PLANNED", "DRAFTED", "REVIEWED", "APPROVED", "PUBLISHED"] as const;
const STATUS_LABEL: Record<string, string> = { PLANNED: "기획", DRAFTED: "초안", REVIEWED: "검토", APPROVED: "승인", PUBLISHED: "게시" };
const inputCls = "w-full rounded-md border border-line px-3 py-2 text-sm text-ink outline-none focus:border-brand";

function thisMonth() {
  // 서버 기준이 아니라 클라이언트 로컬. YYYY-MM.
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export function ContentPlanPanel({ clientId, plans, aiConfigured, canManage }: { clientId: string; plans: Plan[]; aiConfigured: boolean; canManage: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [topic, setTopic] = useState("");
  const [keyword, setKeyword] = useState("");
  const [month, setMonth] = useState(thisMonth());
  const [openId, setOpenId] = useState<string | null>(null);

  function create(generate: boolean) {
    setError(null);
    if (!topic.trim()) return setError("주제를 입력하세요.");
    start(async () => {
      const res = await createContentPlan({ clientId, month, topic, keyword: keyword || null, generate });
      if (!res.ok) {
        setError(res.error === "AI_NOT_CONFIGURED" ? "AI 엔진이 연결되지 않았습니다." : "생성에 실패했습니다.");
        return;
      }
      setTopic("");
      setKeyword("");
      router.refresh();
    });
  }

  function setStatus(id: string, status: string) {
    start(async () => {
      const res = await updateContentPlanStatus({ id, status });
      if (!res.ok) setError("상태 변경 실패");
      else router.refresh();
    });
  }

  function remove(id: string) {
    if (!confirm("이 기획안을 삭제할까요?")) return;
    start(async () => {
      const res = await deleteContentPlan({ id });
      if (!res.ok) setError("삭제 실패");
      else router.refresh();
    });
  }

  const [requested, setRequested] = useState<string | null>(null);
  function askApproval(id: string, topic: string) {
    start(async () => {
      const res = await requestApproval({ targetType: "CONTENT", targetId: id, title: topic, clientId });
      if (!res.ok) setError("승인 요청 실패");
      else {
        setRequested(id);
        setTimeout(() => setRequested(null), 1800);
        router.refresh();
      }
    });
  }

  return (
    <div className="space-y-4">
      {canManage ? (
        <div className="rounded-2xl border border-line bg-white p-4">
          <p className="text-sm font-bold text-ink">콘텐츠 기획 추가</p>
          <div className="mt-3 grid gap-2 sm:grid-cols-[1fr_1fr_120px]">
            <input value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="주제 (예: 여름철 피부 관리)" className={inputCls} />
            <input value={keyword} onChange={(e) => setKeyword(e.target.value)} placeholder="핵심 키워드(선택)" className={inputCls} />
            <input type="month" value={month} onChange={(e) => setMonth(e.target.value)} className={inputCls} />
          </div>
          {error ? <p className="mt-2 text-sm text-danger">{error}</p> : null}
          <div className="mt-3 flex gap-2">
            <button type="button" onClick={() => create(false)} disabled={pending} className="rounded-md border border-line px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-surface disabled:opacity-50">주제만 등록</button>
            <button type="button" onClick={() => create(true)} disabled={pending || !aiConfigured} className="inline-flex items-center gap-1.5 rounded-md bg-brand px-3 py-2 text-sm font-semibold text-white disabled:opacity-50">
              <Sparkles className="h-4 w-4" /> {pending ? "생성 중…" : "AI 초안 + 의료법 검수"}
            </button>
          </div>
          {!aiConfigured ? <p className="mt-1 text-xs text-slate-400">AI 초안은 ANTHROPIC_API_KEY 연동 시 켜집니다.</p> : null}
        </div>
      ) : null}

      {plans.length === 0 ? (
        <p className="rounded-xl border border-dashed border-line bg-surface/40 px-4 py-8 text-center text-sm text-slate-500">아직 콘텐츠 기획이 없습니다.</p>
      ) : (
        <ul className="space-y-2">
          {plans.map((pl) => {
            const risk = pl.complianceRisk;
            const hasRisk = risk && (risk.high > 0 || risk.medium > 0);
            return (
              <li key={pl.id} className="rounded-lg border border-line bg-white p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded bg-surface px-1.5 py-0.5 text-xs text-slate-500">{pl.month}</span>
                  <span className="text-sm font-semibold text-ink">{pl.topic}</span>
                  {pl.keyword ? <span className="rounded-full bg-brand-soft px-2 py-0.5 text-xs text-brand-strong">{pl.keyword}</span> : null}
                  {risk ? (
                    hasRisk ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-rose-50 px-2 py-0.5 text-xs font-semibold text-rose-600"><AlertTriangle className="h-3 w-3" /> 의료법 {risk.high + risk.medium}</span>
                    ) : (
                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-600"><ShieldCheck className="h-3 w-3" /> 이상 없음</span>
                    )
                  ) : null}
                  <span className="ml-auto rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-500">{STATUS_LABEL[pl.status] ?? pl.status}</span>
                  {(pl.angle || pl.faq.length > 0) ? (
                    <button type="button" onClick={() => setOpenId(openId === pl.id ? null : pl.id)} className="rounded-md border border-line px-2 py-1 text-xs text-slate-600 hover:bg-surface">{openId === pl.id ? "접기" : "보기"}</button>
                  ) : null}
                  {canManage ? <button type="button" onClick={() => remove(pl.id)} disabled={pending} className="text-slate-400 hover:text-danger disabled:opacity-50" aria-label="삭제"><Trash2 className="h-4 w-4" /></button> : null}
                </div>

                {canManage ? (
                  <div className="mt-2 flex flex-wrap items-center gap-1">
                    {STATUSES.map((s) => (
                      <button key={s} type="button" onClick={() => setStatus(pl.id, s)} disabled={pending || pl.status === s}
                        className={`rounded px-2 py-0.5 text-xs font-semibold ${pl.status === s ? "bg-brand text-white" : "border border-line text-slate-500 hover:bg-surface"}`}>{STATUS_LABEL[s]}</button>
                    ))}
                    <button type="button" onClick={() => askApproval(pl.id, pl.topic)} disabled={pending} className="ml-1 rounded px-2 py-0.5 text-xs font-semibold text-brand-strong hover:bg-brand-soft disabled:opacity-50">
                      {requested === pl.id ? "요청됨" : "승인 요청"}
                    </button>
                  </div>
                ) : null}

                {openId === pl.id ? (
                  <div className="mt-3 space-y-3 border-t border-line pt-3 text-sm">
                    {pl.angle ? <div><p className="text-xs font-bold text-slate-500">콘텐츠 방향</p><p className="mt-1 leading-6 text-slate-700">{pl.angle}</p></div> : null}
                    {pl.faq.length > 0 ? <div><p className="text-xs font-bold text-slate-500">FAQ</p><ul className="mt-1 list-disc space-y-0.5 pl-5 text-slate-700">{pl.faq.map((f, i) => <li key={i}>{f}</li>)}</ul></div> : null}
                    {pl.qa.length > 0 ? <div><p className="text-xs font-bold text-slate-500">Q&amp;A</p><dl className="mt-1 space-y-1.5">{pl.qa.map((x, i) => <div key={i}><dt className="font-medium text-ink">Q. {x.q}</dt><dd className="text-slate-600">A. {x.a}</dd></div>)}</dl></div> : null}
                    {hasRisk && risk ? (
                      <div className="rounded-md bg-rose-50/60 p-2">
                        <p className="text-xs font-bold text-rose-600">의료법 위험 표현</p>
                        <div className="mt-1 flex flex-wrap gap-1">{risk.flags.map((f, i) => <span key={i} className="rounded bg-white px-1.5 py-0.5 text-xs text-rose-700">{f.matched}<span className="text-slate-400"> · {f.label}</span></span>)}</div>
                        <p className="mt-1 text-xs text-slate-400">※ 최종 게시 전 담당자·관리자 승인 필요</p>
                      </div>
                    ) : null}
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
