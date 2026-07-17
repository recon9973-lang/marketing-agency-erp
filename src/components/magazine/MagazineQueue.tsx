// 목표 경로: src/components/magazine/MagazineQueue.tsx
//
// 매거진 큐 테이블 — 상태별 액션(AI 초안·초안 보기·검토 완료·삭제). 데스크톱 테이블/모바일 카드.
"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { magazineKindLabels, magazineStatusLabels, type MagazineKind, type MagazineStatus } from "@/domain/content/magazine";
import type { MagazineRow } from "@/server/repositories/magazine";
import { deleteMagazinePost, draftMagazinePost, setMagazineStatus, publishMagazinePost } from "@/server/actions/magazine";
import { renderMagazineCover } from "@/components/magazine/cover";
import { StatusBadge, toneForStatus } from "@/components/ui/StatusBadge";
import { ConfirmModal, Modal } from "@/components/ui/Modal";

type CoverMode = "auto" | "url" | "none";

function label(row: MagazineRow) {
  return {
    kind: magazineKindLabels[row.kind as MagazineKind] ?? row.kind,
    status: magazineStatusLabels[row.status as MagazineStatus] ?? row.status
  };
}

/** 예약 시각 표시(로컬). */
function fmtWhen(iso: string): string {
  try {
    return new Date(iso).toLocaleString("ko-KR", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" });
  } catch {
    return iso;
  }
}

type Dialog = { kind: "delete" | "preview" | "publish"; row: MagazineRow } | null;

export function MagazineQueue({ rows }: { rows: MagazineRow[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [dialog, setDialog] = useState<Dialog>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [coverUrl, setCoverUrl] = useState("");
  const [coverMode, setCoverMode] = useState<CoverMode>("auto");
  const [coverData, setCoverData] = useState("");
  const [coverBusy, setCoverBusy] = useState(false);
  const [scheduleAt, setScheduleAt] = useState("");

  // 발행 모달 열림 → 제목·카테고리로 온브랜드 커버 자동 생성(미리보기).
  useEffect(() => {
    if (dialog?.kind !== "publish") return;
    let cancelled = false;
    setCoverData("");
    setCoverBusy(true);
    renderMagazineCover({
      title: dialog.row.title,
      category: dialog.row.category,
      kindLabel: magazineKindLabels[dialog.row.kind as MagazineKind] ?? dialog.row.kind
    })
      .then((d) => {
        if (!cancelled) setCoverData(d);
      })
      .finally(() => {
        if (!cancelled) setCoverBusy(false);
      });
    return () => {
      cancelled = true;
    };
  }, [dialog]);

  function run(id: string | null, fn: () => Promise<{ ok: boolean; error?: string }>, closeDialog = false) {
    setErr(null);
    setBusyId(id);
    start(async () => {
      const res = await fn();
      setBusyId(null);
      if (!res.ok) setErr(res.error ?? "처리 중 오류가 발생했습니다.");
      else {
        if (closeDialog) setDialog(null);
        router.refresh();
      }
    });
  }

  function rowActions(row: MagazineRow) {
    return (
      <span className="flex flex-wrap items-center justify-end gap-2">
        {row.status === "QUEUED" && (
          <button
            type="button"
            onClick={() => run(row.id, () => draftMagazinePost({ id: row.id }))}
            disabled={pending}
            className="rounded bg-emerald-50 px-1.5 py-0.5 text-[11px] font-semibold text-emerald-700 hover:bg-emerald-100 disabled:opacity-50"
          >
            {busyId === row.id ? "생성 중…" : "⚡ AI 초안"}
          </button>
        )}
        {row.draft && (
          <button type="button" onClick={() => setDialog({ kind: "preview", row })} className="text-[11px] text-slate-500 hover:text-emerald-700">
            초안 보기
          </button>
        )}
        {row.status === "DRAFTED" && (
          <button
            type="button"
            onClick={() => run(row.id, () => setMagazineStatus({ id: row.id, status: "REVIEWED" }))}
            disabled={pending}
            className="text-[11px] font-semibold text-emerald-700 hover:underline disabled:opacity-50"
          >
            검토 완료
          </button>
        )}
        {row.status === "REVIEWED" && (
          <button
            type="button"
            onClick={() => {
              setErr(null);
              setCoverUrl("");
              setCoverMode("auto");
              setScheduleAt("");
              setDialog({ kind: "publish", row });
            }}
            disabled={pending}
            className="rounded bg-emerald-600 px-1.5 py-0.5 text-[11px] font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
          >
            발행
          </button>
        )}
        <button type="button" onClick={() => setDialog({ kind: "delete", row })} className="text-[11px] text-slate-400 hover:text-rose-600">
          삭제
        </button>
      </span>
    );
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
      {err && !dialog && <p className="text-xs text-rose-600">{err}</p>}

      <div className="hidden overflow-x-auto rounded-2xl border border-line bg-card md:block">
        <table className="w-full min-w-[760px] border-collapse text-left text-sm">
          <thead className="border-b border-line bg-surface text-xs font-semibold text-slate-500">
            <tr>
              <th className="px-3 py-2.5">제목</th>
              <th className="px-2 py-2.5">카테고리</th>
              <th className="px-2 py-2.5">유형</th>
              <th className="px-2 py-2.5">상태</th>
              <th className="px-2 py-2.5"></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const l = label(row);
              return (
                <tr key={row.id} className="border-t border-line hover:bg-surface/60">
                  <td className="max-w-[300px] px-3 py-2.5 align-middle font-medium text-ink">
                    {row.status === "PUBLISHED" && row.publishedUrl ? (
                      <a href={row.publishedUrl} target="_blank" rel="noreferrer" className="text-emerald-700 hover:underline">{row.title} ↗</a>
                    ) : (
                      <span className="line-clamp-1">{row.title}</span>
                    )}
                    {row.status === "SCHEDULED" && row.scheduledAt ? (
                      <span className="block text-[11px] font-semibold text-blue-600">🕑 예약 · {fmtWhen(row.scheduledAt)}</span>
                    ) : null}
                    {row.seed ? <span className="block truncate text-[11px] text-slate-400">{row.seed}</span> : null}
                  </td>
                  <td className="px-2 py-2.5 align-middle text-slate-500">{row.category}</td>
                  <td className="px-2 py-2.5 align-middle">
                    <span className="rounded bg-surface px-1.5 py-0.5 text-[11px] text-slate-600">{l.kind}</span>
                  </td>
                  <td className="px-2 py-2.5 align-middle">
                    <StatusBadge tone={toneForStatus(row.status)}>{l.status}</StatusBadge>
                  </td>
                  <td className="px-2 py-2.5 text-right align-middle">{rowActions(row)}</td>
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
              {row.status === "PUBLISHED" && row.publishedUrl ? (
                <a href={row.publishedUrl} target="_blank" rel="noreferrer" className="text-sm font-medium text-emerald-700 hover:underline">{row.title} ↗</a>
              ) : (
                <p className="text-sm font-medium text-ink">{row.title}</p>
              )}
              {row.status === "SCHEDULED" && row.scheduledAt ? (
                <p className="mt-0.5 text-[11px] font-semibold text-blue-600">🕑 예약 · {fmtWhen(row.scheduledAt)}</p>
              ) : null}
              {row.seed ? <p className="mt-0.5 line-clamp-2 text-[11px] text-slate-400">{row.seed}</p> : null}
              <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                <StatusBadge tone={toneForStatus(row.status)}>{l.status}</StatusBadge>
                <span className="rounded bg-surface px-1.5 py-0.5 text-[10px] text-slate-600">{row.category}</span>
                <span className="rounded bg-surface px-1.5 py-0.5 text-[10px] text-slate-600">{l.kind}</span>
              </div>
              <div className="mt-2 border-t border-line pt-2">{rowActions(row)}</div>
            </li>
          );
        })}
      </ul>

      {/* 워드프레스 발행 — 예약 발행 + 커버 자동 생성 */}
      <Modal
        open={dialog?.kind === "publish"}
        onClose={() => setDialog(null)}
        title="워드프레스로 발행"
        footer={
          <>
            <button type="button" onClick={() => setDialog(null)} className="rounded-lg border border-line bg-card px-3.5 py-1.5 text-xs font-semibold text-slate-600 hover:bg-surface">
              취소
            </button>
            <button
              type="button"
              disabled={pending || (coverMode === "auto" && coverBusy)}
              onClick={() =>
                dialog &&
                run(
                  dialog.row.id,
                  () =>
                    publishMagazinePost({
                      id: dialog.row.id,
                      coverImageUrl: coverMode === "url" ? coverUrl.trim() || null : null,
                      coverDataUrl: coverMode === "auto" ? coverData || null : null,
                      scheduledAt: scheduleAt ? new Date(scheduleAt).toISOString() : null
                    }),
                  true
                )
              }
              className="rounded-lg bg-emerald-600 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
            >
              {pending ? (scheduleAt ? "예약 중…" : "발행 중…") : scheduleAt ? "예약 발행" : "발행"}
            </button>
          </>
        }
      >
        <p className="line-clamp-2 rounded-lg bg-surface px-2.5 py-1.5 text-xs text-slate-600">“{dialog?.row.title}”</p>
        <p className="mt-2 text-xs text-slate-500">seokorea.org에 발행됩니다. 카테고리는 자동 매핑됩니다.</p>

        {/* 예약 발행 시각 */}
        <label className="mt-3 block text-xs font-medium text-slate-600">
          예약 발행 시각 (선택)
          <input
            type="datetime-local"
            value={scheduleAt}
            onChange={(e) => setScheduleAt(e.target.value)}
            className="mt-1 w-full rounded-lg border border-line bg-card px-2.5 py-1.5 text-sm text-ink focus:border-emerald-400 focus:outline-none"
          />
        </label>
        <p className="mt-1 text-[11px] text-slate-400">비워두면 즉시 발행. 미래 시각이면 워드프레스에 예약되어 그 시각에 자동 게시됩니다.</p>

        {/* 대표 이미지(커버) */}
        <div className="mt-3">
          <p className="text-xs font-medium text-slate-600">대표 이미지(커버)</p>
          <div className="mt-1.5 inline-flex rounded-lg border border-line bg-surface p-0.5">
            {(
              [
                ["auto", "자동 생성"],
                ["url", "URL 입력"],
                ["none", "없음"]
              ] as [CoverMode, string][]
            ).map(([m, txt]) => (
              <button
                key={m}
                type="button"
                onClick={() => setCoverMode(m)}
                className={`rounded-md px-2.5 py-1 text-[11px] font-semibold ${
                  coverMode === m ? "bg-emerald-600 text-white" : "text-slate-600 hover:text-emerald-700"
                }`}
              >
                {txt}
              </button>
            ))}
          </div>

          {coverMode === "auto" && (
            <div className="mt-2">
              {coverBusy ? (
                <p className="rounded-lg border border-line bg-surface px-2.5 py-6 text-center text-[11px] text-slate-400">커버 생성 중…</p>
              ) : coverData ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={coverData} alt="자동 생성 커버 미리보기" className="w-full rounded-lg border border-line" />
              ) : (
                <p className="text-[11px] text-rose-500">커버 생성에 실패했습니다. ‘URL 입력’ 또는 ‘없음’을 선택하세요.</p>
              )}
              <p className="mt-1 text-[11px] text-slate-400">제목·카테고리로 자동 생성된 온브랜드 커버(1200×630)입니다.</p>
            </div>
          )}

          {coverMode === "url" && (
            <label className="mt-2 block">
              <input
                value={coverUrl}
                onChange={(e) => setCoverUrl(e.target.value)}
                maxLength={1000}
                placeholder="https:// (힉스필드 등 이미지 주소 — 서버가 받아 자동 업로드)"
                className="w-full rounded-lg border border-line bg-card px-2.5 py-1.5 text-sm text-ink placeholder:text-slate-400 focus:border-emerald-400 focus:outline-none"
              />
              <span className="mt-1 block text-[11px] text-slate-400">서버가 이미지를 가져와 대표이미지로 올립니다(서버는 egress 제한 없음).</span>
            </label>
          )}

          {coverMode === "none" && <p className="mt-2 text-[11px] text-slate-400">대표이미지 없이 발행합니다.</p>}
        </div>

        {err && <p className="mt-2 text-xs text-rose-600">{err}</p>}
      </Modal>

      {/* 초안 미리보기 */}
      <Modal open={dialog?.kind === "preview"} onClose={() => setDialog(null)} title={dialog?.row.title ?? "초안"}>
        <pre className="max-h-[60vh] overflow-auto whitespace-pre-wrap rounded-xl border border-line bg-surface p-3 text-[12px] leading-relaxed text-slate-700">
          {dialog?.row.draft}
        </pre>
      </Modal>

      <ConfirmModal
        open={dialog?.kind === "delete"}
        onClose={() => setDialog(null)}
        onConfirm={() => dialog && run(dialog.row.id, () => deleteMagazinePost({ id: dialog.row.id }), true)}
        title="큐 항목 삭제"
        body={
          <>
            <p className="rounded-lg bg-surface px-2.5 py-1.5 text-xs text-slate-600">“{dialog?.row.title}”</p>
            {err && <p className="mt-2 text-xs text-rose-600">{err}</p>}
          </>
        }
        confirmLabel="삭제"
        tone="danger"
        pending={pending}
      />
    </div>
  );
}
