// 목표 경로: src/components/portal/ClientPortalView.tsx
//
// 거래처 포털(공개) — 보고서 열람 + 콘텐츠 컨펌 + 피드백. 로그인 불필요.
"use client";

import { useState, useTransition } from "react";
import { CheckCircle2, MessageSquare, TrendingUp } from "lucide-react";
import { confirmContentByClient, submitClientFeedback } from "@/server/actions/client-portal";
import type { PortalPerformance } from "@/server/repositories/client-portal";

type Report = { id: string; title: string; month: string; summary: string; keywordRanks: { keyword: string; rank: number | null }[] };
type Plan = { id: string; month: string; topic: string; angle: string | null; faq: string[]; qa: { q: string; a: string }[] };

const won = new Intl.NumberFormat("ko-KR");
const CHANNEL_COLOR: Record<string, string> = { place: "#d9662e", blog: "#3b6fe0", homepage: "#10b981" };

// 방문자 추이 스파크라인 — 끝점 원 없음(직선 캡).
function Sparkline({ points, color }: { points: number[]; color: string }) {
  if (points.length < 2) return null;
  const max = Math.max(1, ...points);
  const min = Math.min(...points);
  const range = max - min || 1;
  const w = 120;
  const h = 34;
  const step = w / (points.length - 1);
  const d = points.map((v, i) => `${i * step},${h - ((v - min) / range) * h}`).join(" ");
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="h-9 w-full" preserveAspectRatio="none" role="img">
      <polyline points={d} fill="none" stroke={color} strokeWidth={2} strokeLinejoin="miter" strokeLinecap="butt" />
    </svg>
  );
}

export function ClientPortalView({
  token,
  reports,
  reviewPlans,
  performance
}: {
  token: string;
  reports: Report[];
  reviewPlans: Plan[];
  performance: PortalPerformance;
}) {
  const [pending, start] = useTransition();
  const [confirmed, setConfirmed] = useState<Record<string, boolean>>({});
  const [comments, setComments] = useState<Record<string, string>>({});
  const [feedback, setFeedback] = useState("");
  const [fbDone, setFbDone] = useState(false);

  function confirm(planId: string) {
    start(async () => {
      const res = await confirmContentByClient({ token, planId, comment: comments[planId] || null });
      if (res.ok) setConfirmed((c) => ({ ...c, [planId]: true }));
    });
  }
  function sendFeedback() {
    if (!feedback.trim()) return;
    start(async () => {
      const res = await submitClientFeedback({ token, message: feedback });
      if (res.ok) {
        setFeedback("");
        setFbDone(true);
        setTimeout(() => setFbDone(false), 2500);
      }
    });
  }

  const hasPerformance = performance.channels.length > 0 || performance.ranks.length > 0;

  return (
    <div className="space-y-8">
      {/* 마케팅 성과 요약 */}
      {hasPerformance ? (
        <section>
          <h2 className="mb-3 flex items-center gap-1.5 text-lg font-bold text-ink">
            <TrendingUp className="h-5 w-5 text-brand" /> 마케팅 성과 <span className="text-sm font-normal text-slate-400">최근 {performance.rangeDays}일</span>
          </h2>
          {performance.channels.length > 0 ? (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              {performance.channels.map((c) => (
                <div key={c.channel} className="rounded-2xl border border-line bg-white p-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold text-slate-600">{c.label} 방문자</span>
                    <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: CHANNEL_COLOR[c.channel] ?? "#94a3b8" }} />
                  </div>
                  <p className="mt-1 text-2xl font-extrabold tabular-nums text-ink">{won.format(c.latest)}</p>
                  <p className={`text-xs font-semibold ${c.delta7 > 0 ? "text-emerald-600" : c.delta7 < 0 ? "text-rose-500" : "text-slate-400"}`}>
                    {c.delta7 > 0 ? `▲ ${won.format(c.delta7)}` : c.delta7 < 0 ? `▼ ${won.format(Math.abs(c.delta7))}` : "변동 없음"} <span className="font-normal text-slate-400">지난주 대비</span>
                  </p>
                  <div className="mt-2">
                    <Sparkline points={c.points} color={CHANNEL_COLOR[c.channel] ?? "#94a3b8"} />
                  </div>
                </div>
              ))}
            </div>
          ) : null}
          {performance.ranks.length > 0 ? (
            <div className="mt-3 rounded-2xl border border-line bg-white p-4">
              <p className="mb-2 text-sm font-bold text-ink">검색 순위</p>
              <ul className="flex flex-wrap gap-2">
                {performance.ranks.map((r) => (
                  <li key={r.keyword} className="flex items-center gap-1.5 rounded-full border border-line px-3 py-1 text-sm text-slate-600">
                    {r.keyword} <b className="text-brand-strong">{r.latest != null ? `${r.latest}위` : "-"}</b>
                    {r.delta ? <span className={r.delta > 0 ? "text-emerald-600" : "text-rose-500"}>{r.delta > 0 ? `▲${r.delta}` : `▼${Math.abs(r.delta)}`}</span> : null}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </section>
      ) : null}

      {/* 컨펌 대기 콘텐츠 */}
      <section>
        <h2 className="mb-3 text-lg font-bold text-ink">컨펌 요청 콘텐츠 ({reviewPlans.length})</h2>
        {reviewPlans.length === 0 ? (
          <p className="rounded-2xl border border-line bg-white px-4 py-6 text-center text-sm text-slate-400">컨펌 대기 중인 콘텐츠가 없습니다.</p>
        ) : (
          <ul className="space-y-3">
            {reviewPlans.map((p) => (
              <li key={p.id} className="rounded-2xl border border-line bg-white p-4">
                <div className="flex items-center gap-2">
                  <span className="rounded bg-surface px-1.5 py-0.5 text-xs text-slate-500">{p.month}</span>
                  <span className="text-sm font-bold text-ink">{p.topic}</span>
                </div>
                {p.angle ? <p className="mt-2 text-sm leading-6 text-slate-700">{p.angle}</p> : null}
                {p.faq.length > 0 ? (
                  <ul className="mt-2 list-disc space-y-0.5 pl-5 text-sm text-slate-600">{p.faq.slice(0, 5).map((f, i) => <li key={i}>{f}</li>)}</ul>
                ) : null}
                {confirmed[p.id] ? (
                  <p className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-emerald-600"><CheckCircle2 className="h-4 w-4" /> 컨펌되었습니다. 감사합니다.</p>
                ) : (
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <input value={comments[p.id] ?? ""} onChange={(e) => setComments({ ...comments, [p.id]: e.target.value })} placeholder="수정 요청·의견(선택)" className="min-w-0 flex-1 rounded-md border border-line px-3 py-2 text-sm outline-none focus:border-brand" />
                    <button type="button" onClick={() => confirm(p.id)} disabled={pending} className="rounded-md bg-brand px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">컨펌</button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* 월간 보고서 */}
      <section>
        <h2 className="mb-3 text-lg font-bold text-ink">월간 보고서 ({reports.length})</h2>
        {reports.length === 0 ? (
          <p className="rounded-2xl border border-line bg-white px-4 py-6 text-center text-sm text-slate-400">전달된 보고서가 없습니다.</p>
        ) : (
          <ul className="space-y-3">
            {reports.map((r) => (
              <li key={r.id} className="rounded-2xl border border-line bg-white p-4">
                <div className="flex items-center gap-2">
                  <span className="rounded bg-surface px-1.5 py-0.5 text-xs text-slate-500">{r.month}</span>
                  <span className="text-sm font-bold text-ink">{r.title}</span>
                </div>
                {r.summary ? <p className="mt-2 text-sm leading-6 text-slate-700">{r.summary}</p> : null}
                {r.keywordRanks.length > 0 ? (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {r.keywordRanks.map((k, i) => (
                      <span key={i} className="rounded-full border border-line px-2 py-0.5 text-xs text-slate-600">{k.keyword} <b className="text-brand-strong">{k.rank ?? "-"}위</b></span>
                    ))}
                  </div>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* 피드백 */}
      <section>
        <h2 className="mb-3 flex items-center gap-1.5 text-lg font-bold text-ink"><MessageSquare className="h-5 w-5 text-slate-400" /> 피드백 보내기</h2>
        <div className="rounded-2xl border border-line bg-white p-4">
          <textarea value={feedback} onChange={(e) => setFeedback(e.target.value)} rows={3} placeholder="요청사항·만족도·궁금한 점을 남겨주세요." className="w-full rounded-md border border-line px-3 py-2 text-sm outline-none focus:border-brand" />
          <div className="mt-2 flex items-center gap-3">
            <button type="button" onClick={sendFeedback} disabled={pending} className="rounded-md bg-brand px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">보내기</button>
            {fbDone ? <span className="text-sm text-emerald-600">전달되었습니다. 감사합니다!</span> : null}
          </div>
        </div>
      </section>
    </div>
  );
}
