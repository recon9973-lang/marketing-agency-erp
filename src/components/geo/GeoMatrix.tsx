// 목표 경로: src/components/geo/GeoMatrix.tsx
//
// GEO 질문×엔진 매트릭스. 데스크톱 = overflow-x-auto 래퍼 + sticky 질문열,
// 모바일(md 미만) = 질문 카드 리스트(엔진 칩) — body overflow-x:clip 잘림 방지(패널 결정 #15).
// 상태는 색+텍스트 병기(aria) — ●출현/○미출현/－미기록(퍼블 접근성 지적).
"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { GEO_ENGINES, geoEngineLabels, geoQuestionStatusLabels, type GeoEngine } from "@/domain/sales/geo";
import { approveGeoQuestions, retireGeoQuestion, reactivateGeoQuestion, updateGeoQuestion, deleteGeoQuestion } from "@/server/actions/geo";
import type { GeoQuestionRow } from "@/server/repositories/geo";
import { StatusBadge, toneForStatus } from "@/components/ui/StatusBadge";

function CellMark({ cell }: { cell: GeoQuestionRow["cells"][GeoEngine] }) {
  if (!cell) return <span className="text-slate-300" aria-label="미기록">－</span>;
  if (cell.appeared) {
    return (
      <span
        className={cell.cited ? "font-bold text-emerald-600" : "text-emerald-600"}
        aria-label={cell.cited ? "출현·인용" : "출현"}
        title={`${cell.checkedOn}${cell.cited ? " · 공식 URL 인용" : ""}${cell.snippet ? `\n${cell.snippet}` : ""}`}
      >
        ●{cell.cited ? "+" : ""}
      </span>
    );
  }
  return (
    <span className="text-slate-400" aria-label="미출현" title={cell.checkedOn}>
      ○
    </span>
  );
}

export function GeoMatrix({ clientId, rows }: { clientId: string; rows: GeoQuestionRow[] }) {
  const router = useRouter();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

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

  function retire(id: string) {
    if (!window.confirm("이 질문을 모니터링에서 종료할까요?")) return;
    start(async () => {
      const res = await retireGeoQuestion({ id });
      if (!res.ok) setError(res.error);
      else router.refresh();
    });
  }

  function reactivate(id: string) {
    start(async () => {
      const res = await reactivateGeoQuestion({ id });
      if (!res.ok) setError(res.error);
      else router.refresh();
    });
  }

  function remove(id: string) {
    if (!window.confirm("이 질문과 관측 기록을 완전히 삭제합니다(복구 불가). 진행할까요?")) return;
    start(async () => {
      const res = await deleteGeoQuestion({ id });
      if (!res.ok) setError(res.error);
      else router.refresh();
    });
  }

  function editTargetPage(row: GeoQuestionRow) {
    const url = window.prompt("이 질문에 대응하는 병원 페이지 URL (비우면 제거)", row.targetPageUrl ?? "");
    if (url === null) return;
    start(async () => {
      const res = await updateGeoQuestion({ id: row.id, targetPageUrl: url.trim() || null });
      if (!res.ok) setError(res.error);
      else router.refresh();
    });
  }

  if (rows.length === 0) {
    return (
      <p className="rounded-xl border border-line bg-panel p-6 text-center text-sm text-slate-500">
        질문이 없습니다. 위에서 진료과·지역으로 후보 20개를 생성해보세요.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {/* 배치 승인 바 — 개별 승인 마찰 방지(패널 결정 #7) */}
      {candidates.length > 0 && (
        <div className="flex flex-wrap items-center gap-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2">
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
            className="rounded bg-amber-600 px-3 py-1 text-xs font-semibold text-white disabled:opacity-50"
          >
            선택 {selected.size}건 승인
          </button>
          {error && <span className="text-xs text-rose-600">{error}</span>}
        </div>
      )}

      {/* 데스크톱: 매트릭스 테이블 */}
      <div className="hidden overflow-x-auto rounded-2xl border border-line bg-white md:block">
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
                <td className="px-3 py-2 align-middle">
                  {row.status === "CANDIDATE" && (
                    <input
                      type="checkbox"
                      checked={selected.has(row.id)}
                      onChange={() => toggle(row.id)}
                      aria-label="승인 대상 선택"
                    />
                  )}
                </td>
                <td className="sticky left-0 z-10 max-w-[320px] bg-white px-3 py-2 align-middle text-slate-700">
                  <span className="line-clamp-2">
                    {row.qtype ? <span className="mr-1 rounded bg-surface px-1 py-0.5 text-[10px] text-slate-500">{row.qtype}</span> : null}
                    {row.question}
                  </span>
                  <span className="flex items-center gap-1.5 text-[10px]">
                    {row.targetPageUrl ? (
                      <a href={row.targetPageUrl} target="_blank" rel="noreferrer" className="text-blue-600">
                        대응 페이지 ↗
                      </a>
                    ) : null}
                    <button type="button" onClick={() => editTargetPage(row)} className="text-slate-400 hover:text-blue-600" aria-label="대응 페이지 URL 편집">
                      {row.targetPageUrl ? "✎" : "＋ 대응 페이지"}
                    </button>
                  </span>
                </td>
                <td className="px-2 py-2 align-middle">
                  <StatusBadge tone={toneForStatus(row.status)}>
                    {geoQuestionStatusLabels[row.status as keyof typeof geoQuestionStatusLabels] ?? row.status}
                  </StatusBadge>
                </td>
                {GEO_ENGINES.map((e) => (
                  <td key={e} className="px-2 py-2 text-center align-middle">
                    <CellMark cell={row.cells[e]} />
                  </td>
                ))}
                <td className="px-2 py-2 text-right align-middle">
                  {row.status !== "RETIRED" ? (
                    <button
                      type="button"
                      onClick={() => retire(row.id)}
                      className="text-[11px] text-slate-400 hover:text-rose-600"
                    >
                      종료
                    </button>
                  ) : (
                    <span className="flex justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => reactivate(row.id)}
                        className="text-[11px] text-slate-400 hover:text-emerald-600"
                      >
                        복원
                      </button>
                      <button
                        type="button"
                        onClick={() => remove(row.id)}
                        className="text-[11px] text-slate-400 hover:text-rose-600"
                      >
                        삭제
                      </button>
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* 모바일: 카드 리스트 */}
      <ul className="space-y-2 md:hidden">
        {rows.map((row) => (
          <li key={row.id} className="rounded-xl border border-line bg-white p-3">
            <div className="flex items-start gap-2">
              {row.status === "CANDIDATE" && (
                <input
                  type="checkbox"
                  checked={selected.has(row.id)}
                  onChange={() => toggle(row.id)}
                  className="mt-1"
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
                    <span key={e} className="rounded border border-line bg-surface px-1.5 py-0.5 text-[10px] text-slate-500">
                      {geoEngineLabels[e]} <CellMark cell={row.cells[e]} />
                    </span>
                  ))}
                  {row.status !== "RETIRED" ? (
                    <button type="button" onClick={() => retire(row.id)} className="text-[10px] text-slate-400 hover:text-rose-600">
                      종료
                    </button>
                  ) : (
                    <>
                      <button type="button" onClick={() => reactivate(row.id)} className="text-[10px] text-slate-400 hover:text-emerald-600">
                        복원
                      </button>
                      <button type="button" onClick={() => remove(row.id)} className="text-[10px] text-slate-400 hover:text-rose-600">
                        삭제
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>
          </li>
        ))}
      </ul>

      <p className="text-[11px] text-slate-400">● 출현 · ●+ 출현+공식 URL 인용 · ○ 미출현 · － 미기록 (최신 관측 기준)</p>
    </div>
  );
}
