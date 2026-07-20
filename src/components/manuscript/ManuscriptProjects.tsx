"use client";

// 원고 스튜디오 — 거래처별 집필 프로젝트(프롬프트) + 프로젝트 내부 원고 자체 제작(직접 작성/AI 초안).
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2, Save, Sparkles, FileText, Copy, ShieldCheck, AlertTriangle } from "lucide-react";
import {
  createManuscriptProject,
  updateManuscriptProject,
  deleteManuscriptProject,
  saveManuscriptDraft,
  generateManuscriptDraft,
  deleteManuscriptDraft
} from "@/server/actions/manuscript";
import type { ManuscriptProjectRow, ManuscriptDraftRow } from "@/server/repositories/manuscript";
import type { ComplianceResult } from "@/server/compliance/medical-law";

const KIND_LABELS: Record<string, string> = { BLOG: "블로그", CARD_NEWS: "카드뉴스", SNS: "SNS", AD_COPY: "광고카피" };
const KIND_OPTS = ["BLOG", "CARD_NEWS", "SNS", "AD_COPY"] as const;

export function ManuscriptProjects({
  clientId,
  clientName,
  rows,
  drafts,
  aiConfigured
}: {
  clientId: string;
  clientName: string;
  rows: ManuscriptProjectRow[];
  drafts: ManuscriptDraftRow[];
  aiConfigured: boolean;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [name, setName] = useState("");
  const [prompt, setPrompt] = useState("");

  function create() {
    if (!name.trim()) return;
    start(async () => {
      const res = await createManuscriptProject({ clientId, name, prompt });
      if (res.ok) {
        setName("");
        setPrompt("");
        router.refresh();
      }
    });
  }

  return (
    <div className="space-y-4">
      {/* 새 프로젝트 */}
      <div className="rounded-2xl border border-line bg-card p-5">
        <p className="text-sm font-bold text-ink">새 집필 프로젝트</p>
        <p className="mt-0.5 text-xs text-slate-500">
          <b className="text-slate-600">{clientName}</b>의 집필 방향(톤·차별점·금칙어 등)을 프롬프트로 저장합니다. 이 방향은 AI 초안 생성의 브리프로도 쓰입니다.
        </p>
        <div className="mt-3 space-y-2">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="프로젝트 이름 (예: 임플란트 블로그 시리즈)"
            className="w-full rounded-md border border-line bg-white px-3 py-2.5 text-sm outline-none focus:border-brand"
          />
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="집필 프롬프트·브리프 — 톤앤매너, 핵심 메시지, 차별점, 피해야 할 표현(의료광고법) 등"
            rows={3}
            className="w-full rounded-md border border-line bg-white px-3 py-2.5 text-sm outline-none focus:border-brand"
          />
          <button
            type="button"
            onClick={create}
            disabled={pending || !name.trim()}
            className="inline-flex items-center gap-1.5 rounded-lg bg-brand px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-strong disabled:opacity-50"
          >
            <Plus className="h-4 w-4" /> 프로젝트 만들기
          </button>
        </div>
      </div>

      {/* 프로젝트 목록 */}
      {rows.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-line bg-surface/50 px-4 py-10 text-center text-sm text-slate-500">
          아직 프로젝트가 없습니다. 위에서 첫 집필 프로젝트를 만들어 보세요.
        </p>
      ) : (
        <div className="space-y-3">
          {rows.map((p) => (
            <ProjectCard
              key={p.id}
              row={p}
              drafts={drafts.filter((d) => d.projectId === p.id)}
              aiConfigured={aiConfigured}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function ProjectCard({
  row,
  drafts,
  aiConfigured
}: {
  row: ManuscriptProjectRow;
  drafts: ManuscriptDraftRow[];
  aiConfigured: boolean;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [promptVal, setPromptVal] = useState(row.prompt);
  const promptDirty = promptVal !== row.prompt;

  // 새 초안 작성기
  const [kind, setKind] = useState<(typeof KIND_OPTS)[number]>("BLOG");
  const [topic, setTopic] = useState("");
  const [medicalCheck, setMedicalCheck] = useState(true);
  const [compliance, setCompliance] = useState<ComplianceResult | null>(null);
  const [genErr, setGenErr] = useState<string | null>(null);

  function savePrompt() {
    start(async () => {
      await updateManuscriptProject({ id: row.id, prompt: promptVal });
      router.refresh();
    });
  }
  function removeProject() {
    start(async () => {
      await deleteManuscriptProject({ id: row.id });
      router.refresh();
    });
  }
  function addManual() {
    start(async () => {
      await saveManuscriptDraft({ projectId: row.id, title: topic || "새 원고", kind, body: "", source: "manual" });
      setTopic("");
      router.refresh();
    });
  }
  function generateAi() {
    setGenErr(null);
    setCompliance(null);
    if (!topic.trim()) {
      setGenErr("주제를 입력하세요.");
      return;
    }
    start(async () => {
      const res = await generateManuscriptDraft({ projectId: row.id, topic, kind, medicalCheck });
      if (!res.ok) {
        setGenErr(res.code === "AI_NOT_CONFIGURED" ? "AI가 연동되지 않았습니다. 키 설정 시 자동 생성됩니다. 지금은 ‘직접 작성’으로 원고를 추가하세요." : res.error);
        return;
      }
      setCompliance(res.data?.compliance ?? null);
      setTopic("");
      router.refresh();
    });
  }

  return (
    <div className="rounded-2xl border border-line bg-card p-5">
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm font-bold text-ink">{row.name}</p>
        <button type="button" onClick={removeProject} disabled={pending} className="text-slate-300 hover:text-rose-500" aria-label="프로젝트 삭제">
          <Trash2 className="h-4 w-4" />
        </button>
      </div>

      {/* 집필 프롬프트 */}
      <textarea
        value={promptVal}
        onChange={(e) => setPromptVal(e.target.value)}
        rows={2}
        placeholder="집필 프롬프트·브리프"
        className="mt-2 w-full rounded-md border border-line bg-white px-3 py-2.5 text-sm outline-none focus:border-brand"
      />
      <button
        type="button"
        onClick={savePrompt}
        disabled={pending || !promptDirty}
        className="mt-2 inline-flex items-center gap-1.5 rounded-lg border border-line px-3 py-1.5 text-xs font-semibold text-slate-600 hover:border-brand hover:text-brand disabled:opacity-50"
      >
        <Save className="h-3.5 w-3.5" /> {promptDirty ? "프롬프트 저장" : "저장됨"}
      </button>

      {/* 자체 제작 — 새 원고 */}
      <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50/40 p-3">
        <p className="flex items-center gap-1.5 text-xs font-bold text-emerald-800">
          <FileText className="h-3.5 w-3.5" /> 원고 자체 제작
        </p>
        <div className="mt-2 grid gap-2 sm:grid-cols-[8rem_1fr]">
          <select value={kind} onChange={(e) => setKind(e.target.value as (typeof KIND_OPTS)[number])} className="rounded-md border border-line bg-white px-2 py-2 text-sm outline-none focus:border-emerald-500">
            {KIND_OPTS.map((k) => (
              <option key={k} value={k}>{KIND_LABELS[k]}</option>
            ))}
          </select>
          <input
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            placeholder="원고 주제 (예: 임플란트 재수술 주의사항)"
            className="rounded-md border border-line bg-white px-3 py-2 text-sm outline-none focus:border-emerald-500"
          />
        </div>
        <label className="mt-2 flex items-center gap-1.5 text-[11px] text-slate-600">
          <input type="checkbox" checked={medicalCheck} onChange={(e) => setMedicalCheck(e.target.checked)} className="h-3.5 w-3.5 rounded border-line" />
          AI 생성 시 의료법 검수 적용
        </label>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={generateAi}
            disabled={pending || !aiConfigured}
            title={aiConfigured ? "" : "AI 미연동 — 직접 작성으로 추가하세요"}
            className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3.5 py-2 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
          >
            <Sparkles className="h-3.5 w-3.5" /> AI 초안 생성
          </button>
          <button
            type="button"
            onClick={addManual}
            disabled={pending}
            className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-300 bg-white px-3.5 py-2 text-xs font-semibold text-emerald-700 hover:bg-emerald-50 disabled:opacity-50"
          >
            <Plus className="h-3.5 w-3.5" /> 직접 작성으로 추가
          </button>
          {!aiConfigured ? <span className="text-[11px] text-slate-400">AI 미연동 — 직접 작성만 가능</span> : null}
        </div>
        {genErr ? <p className="mt-1.5 text-xs text-danger">{genErr}</p> : null}
        {compliance ? <ComplianceNote result={compliance} /> : null}
      </div>

      {/* 초안 목록 */}
      {drafts.length > 0 && (
        <div className="mt-3 space-y-2">
          <p className="text-xs font-semibold text-slate-500">원고 {drafts.length}건</p>
          {drafts.map((d) => (
            <DraftItem key={d.id} draft={d} />
          ))}
        </div>
      )}
    </div>
  );
}

function ComplianceNote({ result }: { result: ComplianceResult }) {
  const clean = result.flags.length === 0;
  return (
    <div className={`mt-2 rounded-lg border px-3 py-2 text-xs ${clean ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-amber-200 bg-amber-50 text-amber-800"}`}>
      <p className="flex items-center gap-1.5 font-semibold">
        {clean ? <ShieldCheck className="h-3.5 w-3.5" /> : <AlertTriangle className="h-3.5 w-3.5" />}
        의료법 검수 — {clean ? "위험 표현 없음" : `주의 ${result.flags.length}건 (높음 ${result.highCount} · 중간 ${result.mediumCount})`}
      </p>
      {!clean && (
        <ul className="mt-1 list-disc pl-4">
          {result.flags.slice(0, 6).map((f, i) => (
            <li key={i}>{f.label}: <span className="font-medium">{f.matched}</span></li>
          ))}
        </ul>
      )}
    </div>
  );
}

function DraftItem({ draft }: { draft: ManuscriptDraftRow }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState(draft.title);
  const [body, setBody] = useState(draft.body);
  const dirty = title !== draft.title || body !== draft.body;

  function save() {
    start(async () => {
      await saveManuscriptDraft({ id: draft.id, projectId: draft.projectId, title, body });
      router.refresh();
    });
  }
  function remove() {
    start(async () => {
      await deleteManuscriptDraft({ id: draft.id });
      router.refresh();
    });
  }
  function copy() {
    navigator.clipboard?.writeText(body).catch(() => {});
  }

  return (
    <div className="rounded-xl border border-line bg-white">
      <button type="button" onClick={() => setOpen((v) => !v)} className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left">
        <span className="flex min-w-0 items-center gap-2">
          <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-500">{KIND_LABELS[draft.kind] ?? draft.kind}</span>
          {draft.source === "ai" ? <span className="rounded bg-emerald-100 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-700">AI</span> : null}
          <span className="truncate text-sm font-medium text-ink">{draft.title || "(제목 없음)"}</span>
        </span>
        <span className="shrink-0 text-xs text-slate-400">{open ? "접기" : "열기"}</span>
      </button>
      {open && (
        <div className="border-t border-line p-3">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="제목"
            className="mb-2 w-full rounded-md border border-line bg-white px-3 py-2 text-sm outline-none focus:border-brand"
          />
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={10}
            placeholder="원고 본문을 직접 작성하거나 AI 초안을 다듬으세요."
            className="w-full rounded-md border border-line bg-white px-3 py-2 text-sm leading-relaxed outline-none focus:border-brand"
          />
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <button type="button" onClick={save} disabled={pending || !dirty} className="inline-flex items-center gap-1.5 rounded-lg bg-brand px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-strong disabled:opacity-50">
              <Save className="h-3.5 w-3.5" /> {dirty ? "저장" : "저장됨"}
            </button>
            <button type="button" onClick={copy} className="inline-flex items-center gap-1.5 rounded-lg border border-line px-3 py-1.5 text-xs font-semibold text-slate-600 hover:border-brand hover:text-brand">
              <Copy className="h-3.5 w-3.5" /> 복사
            </button>
            <button type="button" onClick={remove} disabled={pending} className="ml-auto inline-flex items-center gap-1.5 rounded-lg border border-line px-3 py-1.5 text-xs font-semibold text-slate-400 hover:border-rose-300 hover:text-rose-500">
              <Trash2 className="h-3.5 w-3.5" /> 삭제
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
