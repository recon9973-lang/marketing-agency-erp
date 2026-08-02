"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useProjectStore } from "@/lib/journeymap/store";
import { deleteProjectRemote, syncProjects } from "@/lib/journeymap/sync";
import { STAGE_META, STAGES } from "@/lib/journeymap/types";
import { exportCsv } from "@/lib/journeymap/export";

export default function JourneymapDashboard() {
  const { projects, addProject, removeProject } = useProjectStore();
  const [mounted, setMounted] = useState(false);
  const [query, setQuery] = useState("");
  const [syncing, setSyncing] = useState(true);
  useEffect(() => setMounted(true), []);

  // 서버 동기화 — 어느 브라우저에서 열어도 같은 목록이 보이도록 병합 (최초 1회)
  const syncedRef = useRef(false);
  useEffect(() => {
    if (!mounted || syncedRef.current) return;
    syncedRef.current = true;
    const { projects: current, removeProject: rm } = useProjectStore.getState();
    syncProjects(
      current,
      addProject,
      (id, next) => {
        rm(id);
        addProject(next);
      },
      rm
    ).finally(() => setSyncing(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mounted]);

  const filtered = projects.filter((p) => p.mainKeyword.includes(query) || p.profile.name.includes(query));

  return (
    <div className="p-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">🗺️ 키워드 검색여정 마인드맵</h1>
          <p className="text-sm text-slate-500">
            메인 키워드 + 병원 정보를 입력하면 환자 검색여정(탐색→비교→결정→유지)을 자동 생성합니다.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/journeymap/paa"
            className="rounded-lg border border-emerald-600 px-4 py-2 text-sm font-semibold text-emerald-700 hover:bg-emerald-50 dark:hover:bg-emerald-950"
          >
            💬 환자 질문 분석
          </Link>
          <Link
            href="/journeymap/new"
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
          >
            + 새 마인드맵
          </Link>
        </div>
      </div>

      <div className="mb-6 flex items-center gap-3">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="🔍 프로젝트 검색 (키워드·병원명)"
          className="w-80 rounded-lg border px-4 py-2 text-sm focus:border-blue-500 focus:outline-none"
        />
        {syncing && <span className="text-xs text-slate-400">☁️ 서버와 동기화 중…</span>}
        <div className="ml-auto flex gap-2 text-xs text-slate-500">
          {STAGES.map((s) => (
            <span key={s} className="flex items-center gap-1">
              <span className="h-2.5 w-2.5 rounded-full" style={{ background: STAGE_META[s].color }} />
              {STAGE_META[s].label.slice(2)}
            </span>
          ))}
        </div>
      </div>

      {!mounted ? null : filtered.length === 0 ? (
        <div className="rounded-2xl border-2 border-dashed bg-white p-16 text-center">
          <p className="mb-2 text-4xl">🧭</p>
          <p className="mb-1 font-semibold">아직 프로젝트가 없습니다</p>
          <p className="mb-6 text-sm text-slate-500">병원 프로필과 메인 키워드를 입력하면 3분 안에 마인드맵이 나옵니다.</p>
          <Link
            href="/journeymap/new"
            className="rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-700"
          >
            + 새 마인드맵 만들기
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((p) => {
            const kwCount = p.nodes.filter((n) => n.kind === "keyword").length;
            const red = p.nodes.filter((n) => n.riskLevel === "red").length;
            const yellow = p.nodes.filter((n) => n.riskLevel === "yellow").length;
            return (
              <div key={p.id} className="rounded-2xl border bg-white p-5 shadow-sm transition hover:shadow-md">
                <Link href={`/journeymap/map/${p.id}`} className="block">
                  <div className="mb-3 flex h-20 items-center justify-center rounded-lg bg-slate-50 text-3xl">
                    {p.status === "collecting" ? "🔄" : "🗺️"}
                  </div>
                  <p className="font-bold">{p.mainKeyword}</p>
                  <p className="text-sm text-slate-500">{p.profile.name}</p>
                  <div className="mt-3 flex items-center gap-3 text-xs text-slate-500">
                    <span>노드 {kwCount}</span>
                    {red > 0 && <span className="text-red-600">🔴 {red}</span>}
                    {yellow > 0 && <span className="text-amber-600">🟡 {yellow}</span>}
                    <span className="ml-auto">{new Date(p.updatedAt).toLocaleDateString("ko-KR")}</span>
                  </div>
                </Link>
                <div className="mt-3 flex gap-2 border-t pt-3 text-xs">
                  <button onClick={() => exportCsv(p)} className="rounded border px-2 py-1 text-slate-600 hover:bg-slate-50 dark:hover:bg-slate-800">
                    CSV
                  </button>
                  <button
                    onClick={() => {
                      if (confirm(`"${p.mainKeyword} × ${p.profile.name}" 프로젝트를 삭제할까요?`)) {
                        removeProject(p.id);
                        void deleteProjectRemote(p.id);
                      }
                    }}
                    className="ml-auto rounded border px-2 py-1 text-red-500 hover:bg-red-50 dark:hover:bg-red-950"
                  >
                    삭제
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
