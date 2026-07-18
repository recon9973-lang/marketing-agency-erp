// 목표 경로: src/components/contracts/ContractSurveys.tsx
//
// 계약 설문 — 상품 기반 자동생성 → 공개 링크 발송 → 응답 확인.
"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ClipboardList, Copy, Send, Trash2 } from "lucide-react";
import { createSurveyForContract, sendSurvey, deleteSurvey } from "@/server/actions/surveys";

type Question = { id: string; label: string; type: string; options?: string[]; required?: boolean };
type Survey = {
  id: string;
  title: string;
  status: string;
  round: number;
  publicToken: string;
  questions: Question[];
  responses: { answers: Record<string, string>; submittedAt: string }[];
  createdAt: string;
};

const STATUS_LABEL: Record<string, string> = { DRAFT: "초안", SENT: "발송됨", COMPLETED: "응답완료" };
const dateFmt = new Intl.DateTimeFormat("ko-KR", { dateStyle: "short", timeStyle: "short" });

export function ContractSurveys({ contractId, surveys, canManage, kakaoConfigured = false }: { contractId: string; surveys: Survey[]; canManage: boolean; kakaoConfigured?: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  // 발송 결과(발송됨/미연동/실패)를 설문별로 표시 — 조용한 실패 방지.
  const [delivery, setDelivery] = useState<{ id: string; note: string; ok: boolean } | null>(null);

  function generate(kind: "START" | "MONTHLY") {
    setError(null);
    start(async () => {
      const res = await createSurveyForContract({ contractId, kind });
      if (!res.ok) setError(res.error === "NOT_FOUND" ? "계약을 찾을 수 없습니다." : "설문 생성에 실패했습니다.");
      else router.refresh();
    });
  }

  function send(id: string, via: "LINK" | "KAKAO") {
    setError(null);
    setDelivery(null);
    start(async () => {
      const res = await sendSurvey({ id, sentVia: via });
      if (!res.ok) setError("발송 처리에 실패했습니다.");
      else {
        const note = res.data?.delivery ?? "발송 처리됨";
        // 알림톡 실제 발송 성공만 ok=true, 그 외(미연동·실패·링크)는 안내(주의색).
        setDelivery({ id, note, ok: note.includes("발송됨") });
        router.refresh();
      }
    });
  }

  function remove(id: string) {
    if (!confirm("이 설문을 삭제할까요?")) return;
    start(async () => {
      const res = await deleteSurvey({ id });
      if (!res.ok) setError("삭제에 실패했습니다.");
      else router.refresh();
    });
  }

  function copyLink(token: string) {
    const url = `${window.location.origin}/survey/${token}`;
    navigator.clipboard?.writeText(url).then(() => {
      setCopied(token);
      setTimeout(() => setCopied(null), 1800);
    });
  }

  return (
    <section className="rounded-2xl border border-line bg-white p-5 print:hidden">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="flex items-center gap-1.5 text-sm font-bold text-ink"><ClipboardList className="h-4 w-4 text-slate-400" /> 설문 (시작 · 마감 점검)</h3>
        {canManage ? (
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => generate("START")} disabled={pending} className="rounded-md bg-brand px-3 py-2 text-sm font-semibold text-white disabled:opacity-50">
              {pending ? "생성 중…" : "시작 설문 생성"}
            </button>
            <button type="button" onClick={() => generate("MONTHLY")} disabled={pending} className="rounded-md border border-brand px-3 py-2 text-sm font-semibold text-brand-strong hover:bg-brand-soft disabled:opacity-50">
              {pending ? "생성 중…" : "마감 점검 설문 생성"}
            </button>
          </div>
        ) : null}
      </div>
      {error ? <p className="mt-2 text-sm text-danger">{error}</p> : null}

      {surveys.length === 0 ? (
        <p className="mt-3 text-sm text-slate-400">아직 설문이 없습니다. <b>시작 설문</b>은 진행 전 1회, <b>마감 점검 설문</b>은 매달 마감 후 생성해 거래처에 링크로 보낼 수 있습니다.</p>
      ) : (
        <ul className="mt-3 space-y-2">
          {surveys.map((s) => (
            <li key={s.id} className="rounded-lg border border-line p-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-semibold text-ink">{s.title}</span>
                <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${s.status === "COMPLETED" ? "bg-brand-soft text-brand-strong" : s.status === "SENT" ? "bg-amber-50 text-amber-600" : "bg-slate-100 text-slate-500"}`}>{STATUS_LABEL[s.status] ?? s.status}</span>
                <span className="text-xs text-slate-400">{s.round > 1 ? `마감 점검 ${s.round - 1}차` : "시작 설문"} · 문항 {s.questions.length} · 응답 {s.responses.length}</span>
                <div className="ml-auto flex items-center gap-1.5">
                  <button type="button" onClick={() => copyLink(s.publicToken)} className="inline-flex items-center gap-1 rounded-md border border-line px-2 py-1 text-xs text-slate-600 hover:bg-surface">
                    <Copy className="h-3.5 w-3.5" /> {copied === s.publicToken ? "복사됨" : "링크"}
                  </button>
                  {canManage && s.status === "DRAFT" ? (
                    <>
                      <button type="button" onClick={() => send(s.id, "LINK")} disabled={pending} className="inline-flex items-center gap-1 rounded-md border border-line px-2 py-1 text-xs font-semibold text-brand-strong hover:bg-surface disabled:opacity-50">
                        <Send className="h-3.5 w-3.5" /> 발송
                      </button>
                      <button type="button" onClick={() => send(s.id, "KAKAO")} disabled={pending} title={kakaoConfigured ? "카카오 알림톡 발송" : "알림톡 미연동 — 클릭 시 링크 전달 안내"} className="inline-flex items-center gap-1 rounded-md border border-line px-2 py-1 text-xs font-semibold text-amber-600 hover:bg-amber-50 disabled:opacity-50">
                        <Send className="h-3.5 w-3.5" /> 알림톡{kakaoConfigured ? "" : "(미연동)"}
                      </button>
                    </>
                  ) : null}
                  {s.responses.length > 0 ? (
                    <button type="button" onClick={() => setOpenId(openId === s.id ? null : s.id)} className="rounded-md border border-line px-2 py-1 text-xs text-slate-600 hover:bg-surface">
                      {openId === s.id ? "응답 닫기" : "응답 보기"}
                    </button>
                  ) : null}
                  {canManage ? (
                    <button type="button" onClick={() => remove(s.id)} disabled={pending} className="text-slate-400 hover:text-danger disabled:opacity-50" aria-label="삭제"><Trash2 className="h-4 w-4" /></button>
                  ) : null}
                </div>
              </div>

              {delivery?.id === s.id ? (
                <p className={`mt-2 rounded-md px-2 py-1 text-xs ${delivery.ok ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}>
                  {delivery.ok ? "✓ " : "ⓘ "}{delivery.note}
                </p>
              ) : null}

              {openId === s.id ? (
                <div className="mt-3 space-y-3 border-t border-line pt-3">
                  {s.responses.map((r, i) => (
                    <div key={i} className="rounded-md bg-surface/50 p-3">
                      <p className="mb-2 text-xs text-slate-400">{dateFmt.format(new Date(r.submittedAt))} 제출</p>
                      <dl className="space-y-1.5">
                        {s.questions.map((q) => (
                          <div key={q.id} className="grid grid-cols-[140px_1fr] gap-2 text-sm">
                            <dt className="text-slate-500">{q.label}</dt>
                            <dd className="whitespace-pre-wrap text-ink">{r.answers[q.id] || <span className="text-slate-300">-</span>}</dd>
                          </div>
                        ))}
                      </dl>
                    </div>
                  ))}
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
