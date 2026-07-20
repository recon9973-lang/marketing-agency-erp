"use client";

// 원고 스튜디오 — 거래처별 집필 프로젝트(프롬프트) 관리. 실제 콘텐츠 생성은 GEO에서 이어서 진행.
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2, Wand2, Save } from "lucide-react";
import { createManuscriptProject, updateManuscriptProject, deleteManuscriptProject } from "@/server/actions/manuscript";
import type { ManuscriptProjectRow } from "@/server/repositories/manuscript";

export function ManuscriptProjects({
  clientId,
  clientName,
  rows
}: {
  clientId: string;
  clientName: string;
  rows: ManuscriptProjectRow[];
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [name, setName] = useState("");
  const [prompt, setPrompt] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);

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

  function savePrompt(id: string, value: string) {
    setBusyId(id);
    start(async () => {
      await updateManuscriptProject({ id, prompt: value });
      setBusyId(null);
      router.refresh();
    });
  }

  function remove(id: string) {
    setBusyId(id);
    start(async () => {
      await deleteManuscriptProject({ id });
      setBusyId(null);
      router.refresh();
    });
  }

  return (
    <div className="space-y-4">
      {/* 새 프로젝트 */}
      <div className="rounded-2xl border border-line bg-card p-5">
        <p className="text-sm font-bold text-ink">새 집필 프로젝트</p>
        <p className="mt-0.5 text-xs text-slate-500">
          <b className="text-slate-600">{clientName}</b>의 집필 방향(톤·차별점·금칙어 등)을 프롬프트로 저장해 두면, GEO 콘텐츠 생성에서 재사용합니다.
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
            <ProjectCard key={p.id} row={p} clientId={clientId} busy={busyId === p.id} onSave={savePrompt} onRemove={remove} />
          ))}
        </div>
      )}
    </div>
  );
}

function ProjectCard({
  row,
  clientId,
  busy,
  onSave,
  onRemove
}: {
  row: ManuscriptProjectRow;
  clientId: string;
  busy: boolean;
  onSave: (id: string, value: string) => void;
  onRemove: (id: string) => void;
}) {
  const [value, setValue] = useState(row.prompt);
  const dirty = value !== row.prompt;
  return (
    <div className="rounded-2xl border border-line bg-card p-5">
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm font-bold text-ink">{row.name}</p>
        <button type="button" onClick={() => onRemove(row.id)} disabled={busy} className="text-slate-300 hover:text-rose-500" aria-label="삭제">
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
      <textarea
        value={value}
        onChange={(e) => setValue(e.target.value)}
        rows={3}
        placeholder="집필 프롬프트·브리프"
        className="mt-2 w-full rounded-md border border-line bg-white px-3 py-2.5 text-sm outline-none focus:border-brand"
      />
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => onSave(row.id, value)}
          disabled={busy || !dirty}
          className="inline-flex items-center gap-1.5 rounded-lg border border-line px-3 py-1.5 text-xs font-semibold text-slate-600 hover:border-brand hover:text-brand disabled:opacity-50"
        >
          <Save className="h-3.5 w-3.5" /> {dirty ? "프롬프트 저장" : "저장됨"}
        </button>
        <a
          href={`/geo?client=${clientId}&tab=content`}
          className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700"
        >
          <Wand2 className="h-3.5 w-3.5" /> GEO에서 콘텐츠 제작
        </a>
      </div>
    </div>
  );
}
