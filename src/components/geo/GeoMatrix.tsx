// 목표 경로: src/components/geo/GeoMatrix.tsx
//
// GEO 질문×엔진 매트릭스. 데스크톱 = overflow-x-auto 래퍼 + sticky 질문열,
// 모바일(md 미만) = 질문 카드 리스트(엔진 칩) — body overflow-x:clip 잘림 방지(패널 결정 #15).
// UI/UX 리디자인: window.confirm/prompt → 모달, 관측 상태 = 도트 배지(색+aria 텍스트 병기).
"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { GEO_ENGINES, geoEngineLabels, geoQuestionStatusLabels, type GeoEngine } from "@/domain/sales/geo";
import { approveGeoQuestions, retireGeoQuestion, reactivateGeoQuestion, updateGeoQuestion, deleteGeoQuestion, generateAnswerPage } from "@/server/actions/geo";
import type { GeoQuestionRow } from "@/server/repositories/geo";
import { StatusBadge, toneForStatus } from "@/components/ui/StatusBadge";
import { ConfirmModal, Modal } from "@/components/ui/Modal";

function CellMark({ cell }: { cell: GeoQuestionRow["cells"][GeoEngine] }) {
  if (!cell) {
    return (
      <span className="inline-block text-slate-300" aria-label="미기록">
        –
      </span>
    );
  }
  if (cell.appeared) {
    return (
      <span
        className={`inline-block h-3 w-3 rounded-full bg-emerald-600 align-middle ${cell.cited ? "ring-[3px] ring-emerald-600/25" : ""}`}
        aria-label={cell.cited ? "출현·인용" : "출현"}
        title={`${cell.checkedOn}${cell.cited ? " · 공식 URL 인용" : ""}${cell.snippet ? `\n${cell.snippet}` : ""}`}
      />
    );
  }
  return (
    <span
      className="inline-block h-3 w-3 rounded-full border-2 border-slate-300 align-middle"
      aria-label="미출현"
      title={cell.checkedOn}
    />
  );
}

type Dialog =
  | { kind: "retire" | "delete" | "generate"; row: GeoQuestionRow }
  | { kind: "url"; row: GeoQuestionRow }
  | null;

export function GeoMatrix({ clientId, rows }: { clientId: string; rows: GeoQuestionRow[] }) {
  const router = useRouter();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [dialog, setDialog] = useState<Dialog>(null);
  const [urlDraft, setUrlDraft] = useState("");

  const candidates = rows.filter((r) => r.status === "CANDIDATE");

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function approveSelected() {
    if (selected.size === 0) return;
    setError(null);
    start(async () => {
      const res = await approveGeoQuestions({ clientId, questionIds: [...selected] });
      if (!res.ok) setError(res.error);
      else {
        setSelected(new Set());
        router.refresh();
      }
    });
  }

  /** 모달 확인 → 액션 실행. 성공 시 모달 닫고 새로고침, 실패 시 모달 안에 에러 표시. */
  function runDialogAction(fn: () => Promise<{ ok: boolean; error?: string }>) {
    setError(null);
    start(async () => {
      const res = await fn();
      if (!res.ok) setError(res.error ?? "처리 중 오류가 발생했습니다.");
      else {
        setDialog(null);
        router.refresh();
      }
    });
  }

  function openDialog(d: Exclude<Dialog, null>) {
    setError(null);
    if (d.kind === "url") setUrlDraft(d.row.targetPageUrl ?? "");
    setDialog(d);
  }

  function reactivate(id: string) {
    start(async () => {
      const res = await reactivateGeoQuestion({ id });
      if (!res.ok) setError(res.error);
      else router.refresh();
    });
  }

  const rowActions = (row: GeoQuestionRow, size: "sm" | "xs") => {
    const cls = size === "sm" ? "text-[11px]" : "text-[10px]";
    return row.status !== "RETIRED" ? (
      <button type="button" onClick={() => openDialog({ kind: "retire", row })} className={`${cls} text-slate-400 hover:text-rose-600`}>
        종료
      </button>
    ) : (
      <>
        <button type="button" onClick={() => reactivate(row.id)} className={`${cls} text-slate-400 hover:text-emerald-600`}>
          복원
        </button>
        <button type="button" onClick={() => openDialog({ kind: "delete", row })} className={`${cls} text-slate-400 hover:text-rose-600`}>
          삭제
        </button>
      </>
    );
  };

  if (rows.length === 0) {
    return (
      <p className="rounded-2xl border border-line bg-card p-6 text-center text-sm text-slate-500">
        질문이 없습니다. “질문 설계” 탭에서 진료과·지역으로 후보 20개를 생성해보세요.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {/* 배치 승인 바 — 개별 승인 마찰 방지(패널 결정 #7) */}
      {candidates.length > 0 && (
        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 px-3.5 py-2.5">
          <span className="text-xs font-medium text-amber-700">
            후보 {candidates.length}건 — 병원 확인 후 일괄 승인하세요.
          </span>
          <button
            type="button"
            onClick={() => setSelected(new Set(candidates.map((c) => c.id)))}
            className="text-xs font-semibold text-amber-700 underline"
          >
            후보 전체 선택
          </button>
          <button
            type="button"
            onClick={approveSelected}
            disabled={pending || selected.size === 0}
            className="rounded-lg bg-amber-600 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-amber-700 disabled:opacity-50"
          >
            선택 {selected.size}건 승인
          </button>
        </div>
      )}
      {error && !dialog && <p className="text-xs text-rose-600">{error}</p>}

      {/* 데스크톱: 매트릭스 테이블 */}
      <div className="hidden overflow-x-auto rounded-2xl border border-line bg-card md:block">
        <table className="w-full min-w-[760px] border-collapse text-left text-sm">
          <thead className="border-b border-line bg-surface text-xs font-semibold text-slate-500">
            <tr>
              <th className="w-8 px-3 py-2.5"></th>
              <th className="sticky left-0 z-10 bg-surface px-3 py-2.5">질문</th>
              <th className="px-2 py-2.5">상태</th>
              {GEO_ENGINES.map((e) => (
                <th key={e} className="px-2 py-2.5 text-center">
                  {geoEngineLabels[e]}
                </th>
              ))}
              <th className="px-2 py-2.5"></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} className="border-t border-line hover:bg-surface/60">
                <td className="px-3 py-2.5 align-middle">
                  {row.status === "CANDIDATE" && (
                    <input
                      type="checkbox"
                      checked={selected.has(row.id)}
                      onChange={() => toggle(row.id)}
                      className="accent-emerald-600"
                      aria-label="승인 대상 선택"
                    />
                  )}
                </td>
                <td className="sticky left-0 z-10 max-w-[320px] bg-card px-3 py-2.5 align-middle text-slate-700">
                  <span className="line-clamp-2">
                    {row.qtype ? <span className="mr-1 rounded bg-surface px-1 py-0.5 text-[10px] text-slate-500">{row.qtype}</span> : null}
                    {row.question}
                  </span>
                  <span className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[10px]">
                    {row.targetPageUrl ? (
                      <a href={row.targetPageUrl} target="_blank" rel="noreferrer" className="text-emerald-700 hover:underline">
                        대응 페이지 ↗
                      </a>
                    ) : null}
                    <button
                      type="button"
                      onClick={() => openDialog({ kind: "url", row })}
                      className="text-slate-400 hover:text-emerald-700"
                      aria-label="대응 페이지 URL 편집"
                    >
                      {row.targetPageUrl ? "✎" : "＋ 대응 페이지"}
                    </button>
                    {(row.status === "APPROVED" || row.status === "MONITORING") &&
                      (row.answerPlanId ? (
                        <a href={`/clients/${clientId}`} className="rounded bg-emerald-50 px-1.5 py-0.5 font-semibold text-emerald-600">
                          답변 초안 ✓
                        </a>
                      ) : (
                        <button
                          type="button"
                          onClick={() => openDialog({ kind: "generate", row })}
                          disabled={pending}
                          className="rounded bg-emerald-50 px-1.5 py-0.5 font-semibold text-emerald-700 hover:bg-emerald-100 disabled:opacity-50"
                        >
                          ⚡ 답변 페이지 생성
                        </button>
                      ))}
                  </span>
                </td>
                <td className="px-2 py-2.5 align-middle">
                  <StatusBadge tone={toneForStatus(row.status)}>
                    {geoQuestionStatusLabels[row.status as keyof typeof geoQuestionStatusLabels] ?? row.status}
                  </StatusBadge>
                </td>
                {GEO_ENGINES.map((e) => (
                  <td key={e} className="px-2 py-2.5 text-center align-middle">
                    <CellMark cell={row.cells[e]} />
                  </td>
                ))}
                <td className="px-2 py-2.5 text-right align-middle">
                  <span className="flex justify-end gap-2">{rowActions(row, "sm")}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* 모바일: 카드 리스트 */}
      <ul className="space-y-2 md:hidden">
        {rows.map((row) => (
          <li key={row.id} className="rounded-2xl border border-line bg-card p-3">
            <div className="flex items-start gap-2">
              {row.status === "CANDIDATE" && (
                <input
                  type="checkbox"
                  checked={selected.has(row.id)}
                  onChange={() => toggle(row.id)}
                  className="mt-1 accent-emerald-600"
                  aria-label="승인 대상 선택"
                />
              )}
              <div className="min-w-0 flex-1">
                <p className="text-sm text-slate-700">
                  {row.qtype ? <span className="mr-1 rounded bg-surface px-1 py-0.5 text-[10px] text-slate-500">{row.qtype}</span> : null}
                  {row.question}
                </p>
                <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                  <StatusBadge tone={toneForStatus(row.status)}>
                    {geoQuestionStatusLabels[row.status as keyof typeof geoQuestionStatusLabels] ?? row.status}
                  </StatusBadge>
                  {GEO_ENGINES.map((e) => (
                    <span key={e} className="inline-flex items-center gap-1 rounded border border-line bg-surface px-1.5 py-0.5 text-[10px] text-slate-500">
                      {geoEngineLabels[e]} <CellMark cell={row.cells[e]} />
                    </span>
                  ))}
                  {(row.status === "APPROVED" || row.status === "MONITORING") && !row.answerPlanId && (
                    <button
                      type="button"
                      onClick={() => openDialog({ kind: "generate", row })}
                      disabled={pending}
                      className="rounded bg-emerald-50 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-700 disabled:opacity-50"
                    >
                      ⚡ 답변 페이지
                    </button>
                  )}
                  {rowActions(row, "xs")}
                </div>
              </div>
            </div>
          </li>
        ))}
      </ul>

      {/* 범례 — 색+모양+텍스트 병기(접근성) */}
      <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-slate-400">
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-block h-3 w-3 rounded-full bg-emerald-600 ring-[3px] ring-emerald-600/25" /> 출현+공식 URL 인용
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-block h-3 w-3 rounded-full bg-emerald-600" /> 출현
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-block h-3 w-3 rounded-full border-2 border-slate-300" /> 미출현
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="text-slate-300">–</span> 미기록
        </span>
        <span>(최신 관측 기준)</span>
      </p>

      {/* ── 모달 ── */}
      <ConfirmModal
        open={dialog?.kind === "retire"}
        onClose={() => setDialog(null)}
        onConfirm={() => dialog && runDialogAction(() => retireGeoQuestion({ id: dialog.row.id }))}
        title="모니터링 종료"
        body={
          <>
            <p className="line-clamp-2 rounded-lg bg-surface px-2.5 py-1.5 text-xs text-slate-600">“{dialog?.row.question}”</p>
            <p className="mt-2 text-xs text-slate-500">종료해도 관측 기록은 보존되며, 언제든 복원할 수 있습니다.</p>
            {error && <p className="mt-2 text-xs text-rose-600">{error}</p>}
          </>
        }
        confirmLabel="종료"
        pending={pending}
      />
      <ConfirmModal
        open={dialog?.kind === "delete"}
        onClose={() => setDialog(null)}
        onConfirm={() => dialog && runDialogAction(() => deleteGeoQuestion({ id: dialog.row.id }))}
        title="질문 완전 삭제"
        body={
          <>
            <p className="line-clamp-2 rounded-lg bg-surface px-2.5 py-1.5 text-xs text-slate-600">“{dialog?.row.question}”</p>
            <p className="mt-2 text-xs text-rose-600">질문과 모든 관측 기록이 삭제되며 복구할 수 없습니다.</p>
            {error && <p className="mt-2 text-xs text-rose-600">{error}</p>}
          </>
        }
        confirmLabel="완전 삭제"
        tone="danger"
        pending={pending}
      />
      <ConfirmModal
        open={dialog?.kind === "generate"}
        onClose={() => setDialog(null)}
        onConfirm={() => dialog && runDialogAction(() => generateAnswerPage({ questionId: dialog.row.id }))}
        title="답변 페이지 초안 생성"
        body={
          <>
            <p className="line-clamp-2 rounded-lg bg-surface px-2.5 py-1.5 text-xs text-slate-600">“{dialog?.row.question}”</p>
            <p className="mt-2 text-xs text-slate-500">
              AI가 BLUF 구조의 답변 페이지 초안(FAQ 스키마 포함)을 만들어 콘텐츠 기획에 추가합니다.
              생성 후 의료법 검수 → 병원 승인 → 게시 순서로 진행됩니다.
            </p>
            {error && <p className="mt-2 text-xs text-rose-600">{error}</p>}
          </>
        }
        confirmLabel="AI 초안 생성"
        pending={pending}
      />
      <Modal
        open={dialog?.kind === "url"}
        onClose={() => setDialog(null)}
        title="대응 페이지 URL"
        footer={
          <>
            <button
              type="button"
              onClick={() => setDialog(null)}
              className="rounded-lg border border-line bg-card px-3.5 py-1.5 text-xs font-semibold text-slate-600 hover:bg-surface"
            >
              취소
            </button>
            <button
              type="button"
              disabled={pending}
              onClick={() =>
                dialog && runDialogAction(() => updateGeoQuestion({ id: dialog.row.id, targetPageUrl: urlDraft.trim() || null }))
              }
              className="rounded-lg bg-emerald-600 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
            >
              {pending ? "저장 중…" : "저장"}
            </button>
          </>
        }
      >
        <p className="line-clamp-2 rounded-lg bg-surface px-2.5 py-1.5 text-xs text-slate-600">“{dialog?.row.question}”</p>
        <input
          value={urlDraft}
          onChange={(e) => setUrlDraft(e.target.value)}
          maxLength={500}
          placeholder="https:// (비우면 제거)"
          className="mt-2 w-full rounded-lg border border-line bg-card px-2.5 py-1.5 text-sm text-ink placeholder:text-slate-400"
        />
        <p className="mt-1.5 text-[11px] text-slate-400">이 질문의 답을 담은 병원 페이지 주소 — 답변 페이지 게시 시 자동으로 채워지기도 합니다.</p>
        {error && <p className="mt-2 text-xs text-rose-600">{error}</p>}
      </Modal>
    </div>
  );
}
