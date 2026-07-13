// 디자인 스튜디오 홈 — 크기 프리셋으로 새 디자인 시작 + 최근 프로젝트 목록.
"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2, Loader2 } from "lucide-react";
import { SIZE_PRESETS } from "@/domain/studio/schema";
import { createStudioProject, deleteStudioProject } from "@/server/actions/studio";

type ProjectCard = {
  id: string;
  title: string;
  kind: string;
  canvasW: number;
  canvasH: number;
  thumbnail: string | null;
  updatedAt: string;
};

export function StudioHome({ projects }: { projects: ProjectCard[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function start(presetKey: string) {
    setError(null);
    startTransition(async () => {
      const res = await createStudioProject({ presetKey });
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
      {/* 새 디자인 시작 */}
      <section>
        <h2 className="mb-3 text-sm font-bold text-ink">새 디자인 시작</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {SIZE_PRESETS.map((p) => {
            const ratio = p.h / p.w;
            return (
              <button
                key={p.key}
                type="button"
                disabled={pending}
                onClick={() => start(p.key)}
                className="group flex flex-col items-center gap-2 rounded-xl border border-line bg-card p-3 text-center hover:border-brand disabled:opacity-50"
              >
                <span className="flex h-24 w-full items-center justify-center rounded-lg bg-surface">
                  <span
                    className="rounded border border-line bg-card shadow-sm transition group-hover:border-brand"
                    style={{ width: 44, height: Math.min(72, Math.max(28, 44 * ratio)) }}
                  />
                </span>
                <span className="text-xs font-medium text-ink">{p.label}</span>
              </button>
            );
          })}
          <button
            type="button"
            disabled={pending}
            onClick={() => start("insta-feed")}
            className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-line bg-card p-3 text-slate-400 hover:border-brand hover:text-brand disabled:opacity-50"
          >
            {pending ? <Loader2 className="h-5 w-5 animate-spin" /> : <Plus className="h-5 w-5" />}
            <span className="text-xs font-medium">빈 캔버스</span>
          </button>
        </div>
        {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
      </section>

      {/* 최근 프로젝트 */}
      <section>
        <h2 className="mb-3 text-sm font-bold text-ink">최근 디자인</h2>
        {projects.length === 0 ? (
          <p className="rounded-xl border border-dashed border-line bg-card px-4 py-10 text-center text-sm text-slate-400">
            아직 만든 디자인이 없습니다. 위에서 크기를 골라 시작하세요.
          </p>
        ) : (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
            {projects.map((p) => (
              <div key={p.id} className="group relative">
                <button
                  type="button"
                  onClick={() => router.push(`/studio/${p.id}`)}
                  className="block w-full overflow-hidden rounded-xl border border-line bg-card text-left hover:border-brand"
                >
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
                <button
                  type="button"
                  aria-label="삭제"
                  disabled={busyId === p.id}
                  onClick={() => remove(p.id)}
                  className="absolute right-2 top-2 hidden rounded-lg bg-black/50 p-1.5 text-white hover:bg-red-600 group-hover:block"
                >
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
