// 디자인 스튜디오 홈 — 템플릿 갤러리 + 크기 프리셋으로 새 디자인 시작 + 최근 프로젝트.
"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2, Loader2 } from "lucide-react";
import { SIZE_PRESETS } from "@/domain/studio/schema";
import { BUILTIN_TEMPLATES, TEMPLATE_CATEGORIES, type TemplateCategoryKey } from "@/domain/studio/templates";
import { TemplatePreview } from "@/components/studio/TemplatePreview";
import { createStudioProject, deleteStudioProject } from "@/server/actions/studio";

type ProjectCard = {
  id: string; title: string; kind: string; canvasW: number; canvasH: number; thumbnail: string | null; updatedAt: string;
};

// 카드 프레임(고정 높이)에 맞춰 프리뷰 너비를 계산 — 갤러리 정렬을 균일하게.
const FRAME_W = 176;
const FRAME_H = 224;
function previewWidth(w: number, h: number): number {
  return Math.min(FRAME_W, FRAME_H * (w / h));
}

export function StudioHome({ projects }: { projects: ProjectCard[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cat, setCat] = useState<"all" | TemplateCategoryKey>("all");

  const templates = useMemo(
    () => (cat === "all" ? BUILTIN_TEMPLATES : BUILTIN_TEMPLATES.filter((t) => t.category === cat)),
    [cat]
  );

  function start(input: Record<string, unknown>) {
    setError(null);
    startTransition(async () => {
      const res = await createStudioProject(input);
      if (res.ok && res.data) router.push(`/studio/${res.data.id}`);
      else setError(res.ok ? "생성에 실패했습니다." : res.error);
    });
  }

  function remove(id: string) {
    if (!confirm("이 디자인을 보관함으로 옮길까요? (목록에서 사라집니다)")) return;
    setBusyId(id);
    startTransition(async () => {
      const res = await deleteStudioProject({ id });
      setBusyId(null);
      if (res.ok) router.refresh();
      else setError(res.error);
    });
  }

  return (
    <div className="space-y-8">
      {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600 dark:bg-red-950/40">{error}</p>}

      {/* 템플릿 갤러리 */}
      <section>
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <h2 className="mr-2 text-sm font-bold text-ink">템플릿으로 시작</h2>
          <button type="button" onClick={() => setCat("all")}
            className={`rounded-full border px-3 py-1 text-xs font-medium ${cat === "all" ? "border-brand bg-brand/10 text-brand" : "border-line text-slate-500 hover:border-brand"}`}>전체</button>
          {TEMPLATE_CATEGORIES.map((c) => (
            <button key={c.key} type="button" onClick={() => setCat(c.key)}
              className={`rounded-full border px-3 py-1 text-xs font-medium ${cat === c.key ? "border-brand bg-brand/10 text-brand" : "border-line text-slate-500 hover:border-brand"}`}>{c.label}</button>
          ))}
        </div>
        <div className="flex flex-wrap gap-4">
          {templates.map((t) => (
            <button key={t.id} type="button" disabled={pending} onClick={() => start({ templateId: t.id })}
              className="group flex flex-col items-center gap-2 disabled:opacity-50" style={{ width: FRAME_W }}>
              <span className="flex items-center justify-center rounded-xl border border-line bg-card p-2 shadow-sm transition group-hover:border-brand group-hover:shadow-md"
                style={{ height: FRAME_H + 16 }}>
                <span className="overflow-hidden rounded-md shadow">
                  <TemplatePreview doc={t.doc} width={previewWidth(t.width, t.height)} />
                </span>
              </span>
              <span className="w-full truncate text-center text-xs font-medium text-ink">{t.title}</span>
            </button>
          ))}
        </div>
      </section>

      {/* 크기로 시작(빈 캔버스) */}
      <section>
        <h2 className="mb-3 text-sm font-bold text-ink">빈 캔버스 · 크기 선택</h2>
        <div className="flex flex-wrap gap-2">
          {SIZE_PRESETS.map((p) => (
            <button key={p.key} type="button" disabled={pending} onClick={() => start({ presetKey: p.key })}
              className="rounded-lg border border-line bg-card px-3 py-2 text-xs font-medium text-slate-600 hover:border-brand hover:text-brand disabled:opacity-50 dark:text-slate-300">
              {p.label}
            </button>
          ))}
          {pending && <span className="flex items-center gap-1 px-2 text-xs text-slate-400"><Loader2 className="h-3.5 w-3.5 animate-spin" /> 생성 중…</span>}
        </div>
      </section>

      {/* 최근 프로젝트 */}
      <section>
        <h2 className="mb-3 text-sm font-bold text-ink">최근 디자인</h2>
        {projects.length === 0 ? (
          <p className="rounded-xl border border-dashed border-line bg-card px-4 py-10 text-center text-sm text-slate-400">
            아직 만든 디자인이 없습니다. 위 템플릿이나 크기를 골라 시작하세요.
          </p>
        ) : (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
            {projects.map((p) => (
              <div key={p.id} className="group relative">
                <button type="button" onClick={() => router.push(`/studio/${p.id}`)}
                  className="block w-full overflow-hidden rounded-xl border border-line bg-card text-left hover:border-brand">
                  <span className="flex aspect-square items-center justify-center bg-surface">
                    {p.thumbnail ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={p.thumbnail} alt={p.title} className="max-h-full max-w-full object-contain" />
                    ) : (
                      <span className="text-2xl font-black text-slate-300">{p.canvasW}×{p.canvasH}</span>
                    )}
                  </span>
                  <span className="block truncate px-2.5 py-2 text-xs font-medium text-ink">{p.title}</span>
                </button>
                <button type="button" aria-label="삭제" disabled={busyId === p.id} onClick={() => remove(p.id)}
                  className="absolute right-2 top-2 hidden rounded-lg bg-black/50 p-1.5 text-white hover:bg-red-600 group-hover:block">
                  {busyId === p.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                </button>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
