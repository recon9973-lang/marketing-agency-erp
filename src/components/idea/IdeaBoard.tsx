"use client";

// 아이디어 → 실행계획서. 러프 아이디어를 입력하면 AI가 표준 실행계획서(마크다운)로 문서화.
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Lightbulb, Sparkles, Save, Trash2, Copy, Download, ChevronDown, Pencil } from "lucide-react";
import { saveIdea, generateIdeaPlan, updateIdeaPlan, deleteIdea } from "@/server/actions/idea";
import type { IdeaRow } from "@/server/repositories/idea";

const inputCls = "w-full rounded-md border border-line bg-white px-3 py-2 text-sm text-ink outline-none focus:border-brand";
const dateFmt = new Intl.DateTimeFormat("ko-KR", { dateStyle: "medium" });

/** 초경량 마크다운 뷰 — 제목/굵게만 강조하고 표·목록은 원문 그대로(pre-wrap). */
function PlanView({ text }: { text: string }) {
  return (
    <div className="space-y-1 text-sm leading-relaxed text-slate-700">
      {text.split("\n").map((line, i) => {
        if (/^#{1,6}\s/.test(line)) {
          const level = line.match(/^#+/)![0].length;
          const content = line.replace(/^#+\s/, "");
          return (
            <p key={i} className={`font-bold text-ink ${level <= 1 ? "mt-2 text-base" : level === 2 ? "mt-2 text-sm" : "text-sm"}`}>
              {content}
            </p>
          );
        }
        if (line.trim() === "") return <div key={i} className="h-1" />;
        return <p key={i} className="whitespace-pre-wrap font-[inherit]">{line}</p>;
      })}
    </div>
  );
}

export function IdeaBoard({
  ideas,
  clients,
  aiConfigured
}: {
  ideas: IdeaRow[];
  clients: { id: string; name: string }[];
  aiConfigured: boolean;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [title, setTitle] = useState("");
  const [idea, setIdea] = useState("");
  const [goal, setGoal] = useState("");
  const [audience, setAudience] = useState("");
  const [constraints, setConstraints] = useState("");
  const [success, setSuccess] = useState("");
  const [clientId, setClientId] = useState("");
  const [error, setError] = useState<string | null>(null);

  function reset() {
    setTitle(""); setIdea(""); setGoal(""); setAudience(""); setConstraints(""); setSuccess(""); setClientId("");
  }

  function create(withPlan: boolean) {
    setError(null);
    if (!title.trim()) {
      setError("아이디어 제목을 입력하세요.");
      return;
    }
    start(async () => {
      const res = await saveIdea({ title, idea, goal, audience, constraints, success, clientId: clientId || null });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      if (withPlan && res.data?.id) {
        const gen = await generateIdeaPlan({ id: res.data.id });
        if (!gen.ok) {
          setError(gen.code === "AI_NOT_CONFIGURED" ? "AI 미연동 — 저장은 됐습니다. 키 설정 시 실행계획서가 생성됩니다." : gen.error);
        }
      }
      reset();
      router.refresh();
    });
  }

  return (
    <div className="space-y-5">
      {/* 아이디어 입력 */}
      <div className="rounded-2xl border border-line bg-card p-5">
        <p className="flex items-center gap-1.5 text-sm font-bold text-ink"><Lightbulb className="h-4 w-4 text-amber-500" /> 새 아이디어</p>
        <p className="mt-0.5 text-xs text-slate-500">러프한 아이디어를 적고 <b>AI 실행계획서 생성</b>을 누르면 요약·가정·로드맵·예산·리스크·KPI가 담긴 표준 계획서로 문서화됩니다. 비어 있는 항목은 합리적 ‘가정’으로 채웁니다.</p>
        <div className="mt-3 space-y-2">
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="아이디어 제목 (예: 치과 첫방문 리뷰 이벤트)" className={inputCls} />
          <textarea value={idea} onChange={(e) => setIdea(e.target.value)} rows={3} placeholder="아이디어 내용을 자유롭게 적으세요. (무엇을 만들거나 바꾸고 싶은지)" className={inputCls} />
          <div className="grid gap-2 sm:grid-cols-2">
            <input value={goal} onChange={(e) => setGoal(e.target.value)} placeholder="목표 (선택) — 해결할 문제·기대 결과" className={inputCls} />
            <input value={audience} onChange={(e) => setAudience(e.target.value)} placeholder="대상 (선택) — 고객·사용자" className={inputCls} />
            <input value={constraints} onChange={(e) => setConstraints(e.target.value)} placeholder="제약 (선택) — 예산·기간·인력·규제" className={inputCls} />
            <input value={success} onChange={(e) => setSuccess(e.target.value)} placeholder="성공 기준 (선택) — 매출·전환·행동" className={inputCls} />
          </div>
          <select value={clientId} onChange={(e) => setClientId(e.target.value)} className={inputCls}>
            <option value="">관련 거래처 (선택)</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <button type="button" onClick={() => create(true)} disabled={pending || !aiConfigured} title={aiConfigured ? "" : "AI 미연동"} className="inline-flex items-center gap-1.5 rounded-lg bg-brand px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-strong disabled:opacity-50">
            <Sparkles className="h-4 w-4" /> {pending ? "처리 중…" : "AI 실행계획서 생성"}
          </button>
          <button type="button" onClick={() => create(false)} disabled={pending} className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-white px-3.5 py-2.5 text-sm font-semibold text-slate-600 hover:border-brand hover:text-brand disabled:opacity-50">
            <Save className="h-4 w-4" /> 저장만
          </button>
          {!aiConfigured ? <span className="text-[11px] text-slate-400">AI 미연동 — 저장 후 키 설정 시 생성 가능</span> : null}
          {error ? <p className="text-xs text-danger">{error}</p> : null}
        </div>
      </div>

      {/* 아이디어 목록 */}
      {ideas.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-line bg-surface/50 px-4 py-10 text-center text-sm text-slate-500">
          아직 아이디어가 없습니다. 위에서 첫 아이디어를 문서화해 보세요.
        </p>
      ) : (
        <div className="space-y-2">
          {ideas.map((it) => (
            <IdeaCard key={it.id} idea={it} aiConfigured={aiConfigured} />
          ))}
        </div>
      )}
    </div>
  );
}

function IdeaCard({ idea, aiConfigured }: { idea: IdeaRow; aiConfigured: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [planDraft, setPlanDraft] = useState(idea.plan ?? "");
  const [err, setErr] = useState<string | null>(null);

  function regenerate() {
    setErr(null);
    start(async () => {
      const res = await generateIdeaPlan({ id: idea.id });
      if (!res.ok) {
        setErr(res.code === "AI_NOT_CONFIGURED" ? "AI가 연동되지 않았습니다." : res.error);
        return;
      }
      setPlanDraft(res.data?.plan ?? "");
      router.refresh();
    });
  }
  function savePlan() {
    start(async () => {
      await updateIdeaPlan({ id: idea.id, plan: planDraft });
      setEditing(false);
      router.refresh();
    });
  }
  function remove() {
    if (!confirm("이 아이디어를 삭제할까요?")) return;
    start(async () => {
      await deleteIdea({ id: idea.id });
      router.refresh();
    });
  }
  function copy() {
    navigator.clipboard?.writeText(idea.plan ?? "").catch(() => {});
  }
  function download() {
    const blob = new Blob([idea.plan ?? ""], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${idea.title.replace(/[\\/:*?"<>|]/g, "_").slice(0, 60)}_실행계획서.md`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="rounded-2xl border border-line bg-card">
      <button type="button" onClick={() => setOpen((v) => !v)} className="flex w-full items-center justify-between gap-2 px-4 py-3 text-left">
        <span className="flex min-w-0 items-center gap-2">
          <Lightbulb className="h-4 w-4 shrink-0 text-amber-500" />
          <span className="truncate text-sm font-semibold text-ink">{idea.title}</span>
          {idea.plan ? (
            <span className="rounded-full bg-emerald-100 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-700">계획서 있음</span>
          ) : (
            <span className="rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-500">초안</span>
          )}
          {idea.clientName ? <span className="rounded bg-brand/10 px-1.5 py-0.5 text-[10px] font-semibold text-brand">{idea.clientName}</span> : null}
        </span>
        <span className="flex shrink-0 items-center gap-2">
          <span className="text-[11px] text-slate-400">{dateFmt.format(new Date(idea.updatedAt))}</span>
          <ChevronDown className={`h-4 w-4 text-slate-400 transition ${open ? "rotate-180" : ""}`} />
        </span>
      </button>

      {open && (
        <div className="space-y-3 border-t border-line p-4">
          {idea.idea ? <p className="whitespace-pre-wrap rounded-lg bg-surface/40 p-3 text-xs text-slate-600">{idea.idea}</p> : null}

          {/* 액션 */}
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" onClick={regenerate} disabled={pending || !aiConfigured} title={aiConfigured ? "" : "AI 미연동"} className="inline-flex items-center gap-1.5 rounded-lg bg-brand px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-strong disabled:opacity-50">
              <Sparkles className="h-3.5 w-3.5" /> {idea.plan ? "재생성" : "AI 실행계획서 생성"}
            </button>
            {idea.plan && !editing && (
              <>
                <button type="button" onClick={() => { setPlanDraft(idea.plan ?? ""); setEditing(true); }} className="inline-flex items-center gap-1.5 rounded-lg border border-line px-3 py-1.5 text-xs font-semibold text-slate-600 hover:border-brand hover:text-brand">
                  <Pencil className="h-3.5 w-3.5" /> 편집
                </button>
                <button type="button" onClick={copy} className="inline-flex items-center gap-1.5 rounded-lg border border-line px-3 py-1.5 text-xs font-semibold text-slate-600 hover:border-brand hover:text-brand">
                  <Copy className="h-3.5 w-3.5" /> 복사
                </button>
                <button type="button" onClick={download} className="inline-flex items-center gap-1.5 rounded-lg border border-line px-3 py-1.5 text-xs font-semibold text-slate-600 hover:border-brand hover:text-brand">
                  <Download className="h-3.5 w-3.5" /> .md
                </button>
              </>
            )}
            <button type="button" onClick={remove} disabled={pending} className="ml-auto inline-flex items-center gap-1.5 rounded-lg border border-line px-3 py-1.5 text-xs font-semibold text-slate-400 hover:border-rose-300 hover:text-rose-500">
              <Trash2 className="h-3.5 w-3.5" /> 삭제
            </button>
          </div>
          {err ? <p className="text-xs text-danger">{err}</p> : null}

          {/* 계획서 */}
          {editing ? (
            <div className="space-y-2">
              <textarea value={planDraft} onChange={(e) => setPlanDraft(e.target.value)} rows={18} className="w-full rounded-lg border border-line bg-white px-3 py-2 font-mono text-xs leading-relaxed outline-none focus:border-brand" />
              <div className="flex gap-2">
                <button type="button" onClick={savePlan} disabled={pending} className="inline-flex items-center gap-1.5 rounded-lg bg-brand px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-strong disabled:opacity-50">
                  <Save className="h-3.5 w-3.5" /> 저장
                </button>
                <button type="button" onClick={() => setEditing(false)} className="rounded-lg border border-line px-3 py-1.5 text-xs font-semibold text-slate-500 hover:bg-surface">취소</button>
              </div>
            </div>
          ) : idea.plan ? (
            <div className="rounded-lg border border-line bg-white p-4">
              <PlanView text={idea.plan} />
            </div>
          ) : (
            <p className="rounded-lg border border-dashed border-line bg-surface/40 px-3 py-6 text-center text-xs text-slate-400">
              아직 실행계획서가 없습니다. ‘AI 실행계획서 생성’으로 문서화하세요.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
