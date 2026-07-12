// 목표 경로: src/components/magazine/MagazineQueue.tsx
//
// 매거진 큐 테이블 — 상태·카테고리·유형 + 삭제. 데스크톱 테이블 / 모바일 카드.
"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { magazineKindLabels, magazineStatusLabels, type MagazineKind, type MagazineStatus } from "@/domain/content/magazine";
import type { MagazineRow } from "@/server/repositories/magazine";
import { deleteMagazinePost } from "@/server/actions/magazine";
import { StatusBadge, toneForStatus } from "@/components/ui/StatusBadge";
import { ConfirmModal } from "@/components/ui/Modal";

function label(row: MagazineRow) {
  return {
    kind: magazineKindLabels[row.kind as MagazineKind] ?? row.kind,
    status: magazineStatusLabels[row.status as MagazineStatus] ?? row.status
  };
}

export function MagazineQueue({ rows }: { rows: MagazineRow[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [target, setTarget] = useState<MagazineRow | null>(null);
  const [err, setErr] = useState<string | null>(null);

  function confirmDelete() {
    if (!target) return;
    setErr(null);
    start(async () => {
      const res = await deleteMagazinePost({ id: target.id });
      if (!res.ok) setErr(res.error);
      else {
        setTarget(null);
        router.refresh();
      }
    });
  }

  if (rows.length === 0) {
    return (
      <p className="rounded-2xl border border-line bg-card p-6 text-center text-sm text-slate-500">
        큐가 비어 있습니다. 위에서 용어·주제를 붙여넣어 등록해보세요.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {err && <p className="text-xs text-rose-600">{err}</p>}

      <div className="hidden overflow-x-auto rounded-2xl border border-line bg-card md:block">
        <table className="w-full min-w-[720px] border-collapse text-left text-sm">
          <thead className="border-b border-line bg-surface text-xs font-semibold text-slate-500">
            <tr>
              <th className="px-3 py-2.5">제목</th>
              <th className="px-2 py-2.5">카테고리</th>
              <th className="px-2 py-2.5">유형</th>
              <th className="px-2 py-2.5">상태</th>
              <th className="px-3 py-2.5">정의(seed)</th>
              <th className="px-2 py-2.5"></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const l = label(row);
              return (
                <tr key={row.id} className="border-t border-line hover:bg-surface/60">
                  <td className="px-3 py-2.5 align-middle font-medium text-ink">
                    {row.publishedUrl ? (
                      <a href={row.publishedUrl} target="_blank" rel="noreferrer" className="text-emerald-700 hover:underline">{row.title} ↗</a>
                    ) : (
                      row.title
                    )}
                  </td>
                  <td className="px-2 py-2.5 align-middle text-slate-500">{row.category}</td>
                  <td className="px-2 py-2.5 align-middle">
                    <span className="rounded bg-surface px-1.5 py-0.5 text-[11px] text-slate-600">{l.kind}</span>
                  </td>
                  <td className="px-2 py-2.5 align-middle">
                    <StatusBadge tone={toneForStatus(row.status)}>{l.status}</StatusBadge>
                  </td>
                  <td className="max-w-[280px] px-3 py-2.5 align-middle text-[12px] text-slate-500">
                    <span className="line-clamp-2">{row.seed ?? "-"}</span>
                  </td>
                  <td className="px-2 py-2.5 text-right align-middle">
                    <button type="button" onClick={() => setTarget(row)} className="text-[11px] text-slate-400 hover:text-rose-600">
                      삭제
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <ul className="space-y-2 md:hidden">
        {rows.map((row) => {
          const l = label(row);
          return (
            <li key={row.id} className="rounded-2xl border border-line bg-card p-3">
              <div className="flex items-start justify-between gap-2">
                <p className="text-sm font-medium text-ink">{row.title}</p>
                <button type="button" onClick={() => setTarget(row)} className="text-[10px] text-slate-400 hover:text-rose-600">삭제</button>
              </div>
              <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                <StatusBadge tone={toneForStatus(row.status)}>{l.status}</StatusBadge>
                <span className="rounded bg-surface px-1.5 py-0.5 text-[10px] text-slate-600">{row.category}</span>
                <span className="rounded bg-surface px-1.5 py-0.5 text-[10px] text-slate-600">{l.kind}</span>
              </div>
              {row.seed ? <p className="mt-1 line-clamp-2 text-[11px] text-slate-500">{row.seed}</p> : null}
            </li>
          );
        })}
      </ul>

      <ConfirmModal
        open={target !== null}
        onClose={() => setTarget(null)}
        onConfirm={confirmDelete}
        title="큐 항목 삭제"
        body={<p className="rounded-lg bg-surface px-2.5 py-1.5 text-xs text-slate-600">“{target?.title}”</p>}
        confirmLabel="삭제"
        tone="danger"
        pending={pending}
      />
    </div>
  );
}
