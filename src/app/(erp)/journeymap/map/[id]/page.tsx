"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Background,
  Controls,
  MiniMap,
  ReactFlow,
  ReactFlowProvider,
  useReactFlow,
  type Edge,
  type NodeTypes,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";

import { DetailPanel } from "@/components/journeymap/DetailPanel";
import { DiagnosisView } from "@/components/journeymap/DiagnosisView";
import { KeywordNode, type KeywordFlowNode } from "@/components/journeymap/KeywordNode";
import { classifyStage, isBrandKeyword } from "@/lib/journeymap/classify";
import { CollectProgress, findForeignNodeIds, runCollection } from "@/lib/journeymap/collector";
import { exportCsv, exportJson, exportPng, exportSvg } from "@/lib/journeymap/export";
import { countDescendants, layoutTree } from "@/lib/journeymap/layout";
import { scanRisk } from "@/lib/journeymap/risk";
import { uid, useProjectStore } from "@/lib/journeymap/store";
import { fetchProjectRemote, pushProject } from "@/lib/journeymap/sync";
import { JNode, Stage, STAGES, STAGE_META } from "@/lib/journeymap/types";

const nodeTypes: NodeTypes = { jnode: KeywordNode };

export default function MapPage() {
  return (
    <ReactFlowProvider>
      <MapInner />
    </ReactFlowProvider>
  );
}

function MapInner() {
  const { id } = useParams<{ id: string }>();
  const { projects, addProject, updateProject } = useProjectStore();
  const project = projects.find((p) => p.id === id);

  const [mounted, setMounted] = useState(false);
  const [progress, setProgress] = useState<CollectProgress | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [stageFilter, setStageFilter] = useState<Record<Stage, boolean>>({
    exploration: true,
    comparison: true,
    decision: true,
    retention: true,
  });
  const [riskOnly, setRiskOnly] = useState(false);
  const [brandOnly, setBrandOnly] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [volumeRefreshing, setVolumeRefreshing] = useState<string | null>(null);
  const [remoteTried, setRemoteTried] = useState(false);
  const [viewTab, setViewTab] = useState<"map" | "diagnosis">("map");
  const [foreignIds, setForeignIds] = useState<string[]>([]);
  const startedRef = useRef(false);
  const flowRef = useRef<HTMLDivElement>(null);
  const { fitView, getNodes } = useReactFlow();
  const [colorMode, setColorMode] = useState<"light" | "dark">("light");

  useEffect(() => setMounted(true), []);

  // 이 브라우저에 없는 프로젝트면 서버에서 불러온다 (다른 기기에서 만든 지도 열람)
  useEffect(() => {
    if (!mounted || project || remoteTried) return;
    setRemoteTried(true);
    fetchProjectRemote(id).then((remote) => {
      if (remote) addProject(remote);
    });
  }, [mounted, project, remoteTried, id, addProject]);

  // 편집 자동 저장 — 변경 2초 후 서버에 반영 (수집 중에는 완료 후 저장)
  useEffect(() => {
    if (!project || project.status === "collecting") return;
    const t = setTimeout(() => void pushProject(project), 2000);
    return () => clearTimeout(t);
  }, [project]);

  // ERP 테마(data-theme)와 캔버스 다크모드 동기화 — 다크모드에서 미니맵이 흰 사각형으로 보이는 문제 해결
  useEffect(() => {
    const el = document.documentElement;
    const update = () => setColorMode(el.getAttribute("data-theme") === "dark" ? "dark" : "light");
    update();
    const obs = new MutationObserver(update);
    obs.observe(el, { attributes: true, attributeFilter: ["data-theme"] });
    return () => obs.disconnect();
  }, []);

  useEffect(() => {
    const t = setTimeout(() => fitView({ padding: 0.15, duration: 300 }), 300);
    return () => clearTimeout(t);
  }, [stageFilter, riskOnly, brandOnly, project?.status, fitView]);

  // ── 소급 타지역 검사: 저장된 맵을 열면 실측 검증으로 타지역 의심 노드를 찾아 배너 표시
  // PAA(환자 질문) 변환 프로젝트는 제외 — 질문 문장에는 인접 생활권 지역명(창원·마산 등)이
  // 자연스럽게 섞이므로 키워드용 타지역 검사가 오탐을 낸다.
  useEffect(() => {
    if (!mounted || !project || (project.status !== "done" && project.status !== "partial_done")) return;
    if (project.id.startsWith("paa_")) return;
    let cancelled = false;
    findForeignNodeIds(project.nodes, project.mainKeyword, project.profile)
      .then((ids) => {
        if (!cancelled && ids.length > 0) setForeignIds(ids);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mounted, project?.id, project?.status]);

  // ── 수집 실행
  useEffect(() => {
    if (!mounted || !project || project.status !== "collecting" || startedRef.current) return;
    startedRef.current = true;
    (async () => {
      try {
        const { nodes, failedSources } = await runCollection(
          project.mainKeyword,
          project.profile,
          project.seeds,
          project.options,
          setProgress
        );
        updateProject(project.id, {
          nodes,
          status: failedSources.filter((s) => !s.includes("키 미설정")).length > 0 ? "partial_done" : "done",
          sourceNote: failedSources.length > 0 ? `일부 기능 제외: ${failedSources.join(", ")}` : undefined,
        });
        setProgress(null);
      } catch (e) {
        updateProject(project.id, { status: "failed", sourceNote: String(e) });
        setProgress(null);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mounted, project?.id, project?.status]);

  // 검색량 다시 조회 — 수집 시점에 조용히 실패했거나 비어 있는 노드를 소급 조회한다.
  // (검색량은 원래 수집 때 1회만 조회되고, 실패해도 표시가 없어 "-" 로 남는 문제의 해결책)
  const refreshVolumes = useCallback(async () => {
    if (!project || volumeRefreshing) return;
    const targets = project.nodes.filter(
      (n) => n.kind === "keyword" && n.source !== "naver_kin" && n.source !== "google_paa" && n.volumePc == null && n.volumeMo == null
    );
    if (targets.length === 0) {
      alert("조회할 키워드가 없습니다. (지식iN·구글 질문 문장은 검색광고 API 에 데이터가 없어 제외되며, 이미 값이 있는 노드는 건너뜁니다)");
      return;
    }
    const byKey = new Map(targets.map((n) => [n.keyword, n.id]));
    const keys = Array.from(byKey.keys()).slice(0, 150);
    let filled = 0;
    let failed = false;
    const updated = new Map<string, { volumePc: number | null; volumeMo: number | null; competition: string | null; cpc: number | null }>();
    for (let i = 0; i < keys.length; i += 5) {
      setVolumeRefreshing(`검색량 조회 중… ${Math.min(i + 5, keys.length)}/${keys.length}`);
      try {
        const res = await fetch("/api/journeymap/volume", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ keywords: keys.slice(i, i + 5) }),
        });
        const data = await res.json();
        if (data.unconfigured) {
          alert("네이버 검색광고 API 키가 설정되지 않아 검색량을 조회할 수 없습니다.");
          setVolumeRefreshing(null);
          return;
        }
        for (const [kw, m] of Object.entries<{ volumePc: number | null; volumeMo: number | null; competition: string | null; cpc: number | null }>(data.results || {})) {
          const id = byKey.get(kw);
          if (!id) continue;
          updated.set(id, m);
          if (m.volumePc != null || m.volumeMo != null) filled++;
        }
      } catch {
        failed = true;
        break;
      }
      await new Promise((r) => setTimeout(r, 150));
    }
    if (updated.size > 0) {
      updateProject(project.id, {
        nodes: project.nodes.map((n) => {
          const m = updated.get(n.id);
          return m ? { ...n, volumePc: m.volumePc, volumeMo: m.volumeMo, competition: m.competition, cpc: m.cpc } : n;
        }),
      });
    }
    setVolumeRefreshing(null);
    alert(
      failed
        ? `조회 중 오류가 발생했습니다. ${filled}개만 채워졌습니다 — 잠시 후 다시 시도하세요.`
        : filled > 0
          ? `검색량 조회 완료 — ${filled}개 키워드에 값이 채워졌습니다. 나머지는 네이버에 데이터가 없는 키워드입니다.`
          : "네이버 검색광고에 데이터가 있는 키워드가 없었습니다. (검색량이 매우 적은 롱테일 키워드는 원래 데이터가 없습니다)"
    );
  }, [project, volumeRefreshing, updateProject]);

  const patchNode = useCallback(
    (nodeId: string, patch: Partial<JNode>) => {
      if (!project) return;
      updateProject(project.id, {
        nodes: project.nodes.map((n) => (n.id === nodeId ? { ...n, ...patch } : n)),
      });
    },
    [project, updateProject]
  );

  const toggleCollapse = useCallback(
    (nodeId: string) => {
      const n = project?.nodes.find((x) => x.id === nodeId);
      if (n) patchNode(nodeId, { collapsed: !n.collapsed });
    },
    [project, patchNode]
  );

  const addChild = useCallback(
    (parentId: string) => {
      if (!project) return;
      const kw = prompt("추가할 키워드를 입력하세요:");
      if (!kw?.trim()) return;
      const parent = project.nodes.find((n) => n.id === parentId);
      const { stage, confidence } = classifyStage(kw, project.profile, project.mainKeyword);
      const risk = scanRisk(kw);
      const node: JNode = {
        id: uid(),
        parentId,
        keyword: kw.trim(),
        kind: "keyword",
        depth: (parent?.depth ?? 1) + 1,
        stage: parent?.kind === "branch" ? parent.stage : stage,
        stageConfidence: confidence,
        stageOverridden: false,
        source: "user",
        score: 50,
        riskLevel: risk.level,
        riskReasons: risk.reasons,
        isBrand: isBrandKeyword(kw, project.profile),
        collapsed: false,
      };
      updateProject(project.id, { nodes: [...project.nodes, node] });
      setSelectedId(node.id);
    },
    [project, updateProject]
  );

  const deleteNode = useCallback(
    (nodeId: string) => {
      if (!project) return;
      const count = countDescendants(project.nodes, nodeId);
      if (!confirm(`이 노드${count > 0 ? `와 하위 ${count}개 노드` : ""}를 삭제할까요?`)) return;
      const toDelete = new Set<string>([nodeId]);
      let changed = true;
      while (changed) {
        changed = false;
        for (const n of project.nodes) {
          if (n.parentId && toDelete.has(n.parentId) && !toDelete.has(n.id)) {
            toDelete.add(n.id);
            changed = true;
          }
        }
      }
      updateProject(project.id, { nodes: project.nodes.filter((n) => !toDelete.has(n.id)) });
      setSelectedId(null);
    },
    [project, updateProject]
  );

  const { rfNodes, rfEdges } = useMemo(() => {
    if (!project) return { rfNodes: [] as KeywordFlowNode[], rfEdges: [] as Edge[] };

    const passes = (n: JNode): boolean => {
      if (n.kind !== "keyword") return true;
      if (n.stage && !stageFilter[n.stage]) return false;
      if (riskOnly && n.riskLevel === "none") return false;
      if (brandOnly && !n.isBrand) return false;
      return true;
    };
    const byId = new Map(project.nodes.map((n) => [n.id, n]));
    const keep = new Set<string>();
    for (const n of project.nodes) {
      if (!passes(n)) continue;
      let cur: JNode | undefined = n;
      while (cur) {
        keep.add(cur.id);
        cur = cur.parentId ? byId.get(cur.parentId) : undefined;
      }
    }
    const filtered = project.nodes.filter((n) => keep.has(n.id));
    const laid = layoutTree(filtered);

    const nodes: KeywordFlowNode[] = laid.map((n) => ({
      id: n.id,
      type: "jnode" as const,
      position: { x: n.x, y: n.y },
      selected: n.id === selectedId,
      data: {
        jnode: n,
        hasChildren: project.nodes.some((c) => c.parentId === n.id),
        hiddenCount: n.collapsed ? countDescendants(project.nodes, n.id) : 0,
        onToggleCollapse: toggleCollapse,
      },
      draggable: true,
    }));
    const laidIds = new Set(laid.map((n) => n.id));
    const edges: Edge[] = laid
      .filter((n) => n.parentId && laidIds.has(n.parentId))
      .map((n) => ({
        id: `e_${n.parentId}_${n.id}`,
        source: n.parentId!,
        target: n.id,
        style: {
          stroke: n.stage ? STAGE_META[n.stage].color : "#94a3b8",
          strokeWidth: n.kind === "branch" ? 2.5 : 1.5,
          opacity: 0.6,
        },
      }));
    return { rfNodes: nodes, rfEdges: edges };
  }, [project, stageFilter, riskOnly, brandOnly, selectedId, toggleCollapse]);

  if (!mounted) return null;
  if (!project) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4">
        <p>프로젝트를 찾을 수 없습니다.</p>
        <Link href="/journeymap" className="text-blue-600 underline">
          마인드맵 목록으로 이동
        </Link>
      </div>
    );
  }

  // ── 수집 진행 화면
  if (project.status === "collecting" || progress) {
    return (
      <div className="flex min-h-[70vh] flex-col items-center justify-center px-6">
        <div className="w-full max-w-md rounded-2xl border bg-white p-8 shadow-sm">
          <p className="mb-1 text-center text-lg font-bold">
            🔄 &ldquo;{project.mainKeyword} × {project.profile.name}&rdquo; 수집 중…
          </p>
          <p className="mb-6 text-center text-xs text-slate-500">약 1~3분 소요됩니다</p>
          <div className="mb-2 h-3 overflow-hidden rounded-full bg-slate-100">
            <div className="h-full rounded-full bg-blue-600 transition-all" style={{ width: `${progress?.percent ?? 2}%` }} />
          </div>
          <p className="mb-4 text-right text-sm font-bold text-blue-600">{progress?.percent ?? 0}%</p>
          <div className="space-y-1.5 text-sm">
            <p>{(progress?.percent ?? 0) > 4 ? "✅" : "🔄"} 시드 확장 ({project.seeds.length}개)</p>
            <p>
              {progress?.phase === "collecting" ? "🔄" : (progress?.percent ?? 0) > 70 ? "✅" : "⏳"} 키워드 수집 — 네이버{" "}
              {progress?.naverCount ?? 0} · 구글 {progress?.googleCount ?? 0} · 지식iN {progress?.kinCount ?? 0}
            </p>
            <p>{progress?.phase === "enriching" ? "🔄" : (progress?.percent ?? 0) > 84 ? "✅" : "⏳"} 검색량·CPC 결합 (검색광고 API)</p>
            <p>
              {progress?.phase === "classifying" ? "🔄" : (progress?.percent ?? 0) > 92 ? "✅" : "⏳"} AI 분류 보정·스코어링·리스크 스캔
            </p>
            {progress?.failedSources && progress.failedSources.length > 0 && (
              <p className="text-amber-600">⚠️ 제외됨: {progress.failedSources.join(", ")}</p>
            )}
          </div>
          <p className="mt-5 truncate text-center text-xs text-slate-400">{progress?.message}</p>
        </div>
      </div>
    );
  }

  const selectedNode = project.nodes.find((n) => n.id === selectedId) || null;
  const redCount = project.nodes.filter((n) => n.riskLevel === "red").length;
  const yellowCount = project.nodes.filter((n) => n.riskLevel === "yellow").length;
  const kwCount = project.nodes.filter((n) => n.kind === "keyword").length;

  return (
    <div className="flex h-[calc(100vh-3.5rem)] flex-col">
      <header className="flex items-center gap-4 border-b bg-white px-4 py-2.5">
        <Link href="/journeymap" className="text-sm text-slate-500 hover:text-slate-900">
          ← 목록
        </Link>
        <h1 className="font-bold">
          {project.mainKeyword} <span className="text-slate-400">×</span> {project.profile.name}
        </h1>
        <div className="flex rounded-lg border p-0.5 text-sm">
          <button
            onClick={() => setViewTab("map")}
            className={`rounded-md px-3 py-1 ${viewTab === "map" ? "bg-slate-900 font-semibold text-white" : "text-slate-500 hover:text-slate-900"}`}
          >
            🗺️ 마인드맵
          </button>
          <button
            onClick={() => setViewTab("diagnosis")}
            className={`rounded-md px-3 py-1 ${viewTab === "diagnosis" ? "bg-slate-900 font-semibold text-white" : "text-slate-500 hover:text-slate-900"}`}
          >
            📊 진단
          </button>
        </div>
        <span className="text-xs text-slate-400">노드 {kwCount}개</span>
        {(redCount > 0 || yellowCount > 0) && (
          <button
            onClick={() => setRiskOnly((v) => !v)}
            className={`rounded-full border px-3 py-1 text-xs ${riskOnly ? "border-red-300 bg-red-50" : "hover:bg-slate-50"}`}
          >
            🔴 {redCount} · 🟡 {yellowCount} — {riskOnly ? "전체 보기" : "리스크만 보기"}
          </button>
        )}
        {project.sourceNote && <span className="text-xs text-amber-600">⚠️ {project.sourceNote}</span>}
        <button
          onClick={refreshVolumes}
          disabled={!!volumeRefreshing}
          className="ml-auto rounded-lg border px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-50"
          title="수집 때 조회에 실패했거나 비어 있는 키워드의 월간 검색량·CPC·경쟁도를 다시 조회합니다"
        >
          {volumeRefreshing || "📊 검색량 다시 조회"}
        </button>
        <div className="relative">
          <button
            onClick={() => setExportOpen((v) => !v)}
            className="rounded-lg bg-slate-900 px-4 py-1.5 text-sm font-semibold text-white hover:bg-slate-700"
          >
            내보내기 ▾
          </button>
          {exportOpen && (
            <div className="absolute right-0 top-10 z-50 w-44 rounded-lg border bg-white py-1 shadow-lg">
              {[
                { label: "PNG (1x)", fn: () => flowRef.current && exportPng(flowRef.current, getNodes(), `journeymap_${project.mainKeyword}.png`, 1) },
                { label: "PNG (2x 고해상도)", fn: () => flowRef.current && exportPng(flowRef.current, getNodes(), `journeymap_${project.mainKeyword}@2x.png`, 2) },
                { label: "SVG", fn: () => flowRef.current && exportSvg(flowRef.current, getNodes(), `journeymap_${project.mainKeyword}.svg`) },
                { label: "CSV (키워드 표)", fn: () => exportCsv(project) },
                { label: "JSON (트리 구조)", fn: () => exportJson(project) },
              ].map((item) => (
                <button
                  key={item.label}
                  onClick={() => {
                    item.fn();
                    setExportOpen(false);
                  }}
                  className="block w-full px-4 py-2 text-left text-sm hover:bg-slate-50"
                >
                  {item.label}
                </button>
              ))}
            </div>
          )}
        </div>
      </header>
      {foreignIds.length > 0 && (
        <div className="flex flex-wrap items-center gap-3 border-b border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-900">
          <span>
            🧹 <b>타지역 의심 키워드 {foreignIds.length}개</b> 발견 —{" "}
            {foreignIds
              .slice(0, 3)
              .map((fid) => project.nodes.find((n) => n.id === fid)?.keyword)
              .filter(Boolean)
              .join(", ")}
            {foreignIds.length > 3 ? " 외" : ""} · 네이버 지역검색 실측 결과 우리 지역 소속이 아닙니다.
          </span>
          <button
            onClick={() => {
              const toDelete = new Set(foreignIds);
              let changed = true;
              while (changed) {
                changed = false;
                for (const n of project.nodes) {
                  if (n.parentId && toDelete.has(n.parentId) && !toDelete.has(n.id)) {
                    toDelete.add(n.id);
                    changed = true;
                  }
                }
              }
              updateProject(project.id, { nodes: project.nodes.filter((n) => !toDelete.has(n.id)) });
              setForeignIds([]);
              setSelectedId(null);
            }}
            className="rounded-lg bg-amber-600 px-3 py-1 text-xs font-bold text-white hover:bg-amber-500"
          >
            모두 제거
          </button>
          <button
            onClick={() => setForeignIds([])}
            className="rounded-lg border border-amber-300 px-3 py-1 text-xs text-amber-700 hover:bg-amber-100"
          >
            무시
          </button>
        </div>
      )}


      {viewTab === "diagnosis" ? (
        <div className="min-h-0 flex-1 overflow-y-auto">
          <DiagnosisView project={project} />
        </div>
      ) : (
      <div className="flex min-h-0 flex-1">
        <aside className="w-52 shrink-0 space-y-5 overflow-y-auto border-r bg-white px-4 py-4 text-sm">
          <div>
            <p className="mb-2 text-xs font-bold text-slate-500">▸ 여정 단계 필터</p>
            {STAGES.map((s) => (
              <label key={s} className="mb-1.5 flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={stageFilter[s]}
                  onChange={(e) => setStageFilter((f) => ({ ...f, [s]: e.target.checked }))}
                />
                <span className="h-2.5 w-2.5 rounded-full" style={{ background: STAGE_META[s].color }} />
                {STAGE_META[s].label}
                <span className="ml-auto text-xs text-slate-400">
                  {project.nodes.filter((n) => n.kind === "keyword" && n.stage === s).length}
                </span>
              </label>
            ))}
          </div>
          <div>
            <p className="mb-2 text-xs font-bold text-slate-500">▸ 표시</p>
            <label className="mb-1.5 flex items-center gap-2">
              <input type="checkbox" checked={riskOnly} onChange={(e) => setRiskOnly(e.target.checked)} />
              리스크 노드만
            </label>
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={brandOnly} onChange={(e) => setBrandOnly(e.target.checked)} />
              브랜드 키워드만
            </label>
          </div>
          <div>
            <p className="mb-2 text-xs font-bold text-slate-500">▸ 인사이트</p>
            {STAGES.map((s) => {
              const top = project.nodes
                .filter((n) => n.kind === "keyword" && n.stage === s)
                .sort((a, b) => b.score - a.score)[0];
              return (
                <div key={s} className="mb-2 rounded-lg p-2" style={{ background: STAGE_META[s].light }}>
                  <p className="text-[11px] font-bold" style={{ color: STAGE_META[s].color }}>
                    {STAGE_META[s].label} TOP
                  </p>
                  <p className="truncate text-xs">{top ? top.keyword : "—"}</p>
                </div>
              );
            })}
          </div>
          <div className="border-t pt-3">
            <p className="mb-2 text-xs font-bold text-slate-500">▸ 범례 (표시 설명)</p>
            <ul className="space-y-1.5 text-[11px] leading-snug text-slate-500">
              <li>
                <span className="font-semibold text-slate-600">● 색 점 — 환자의 검색 여정 4단계</span>
                <ul className="mt-1 space-y-0.5 pl-3">
                  <li>
                    <span style={{ color: STAGE_META.exploration.color }}>① 탐색</span> — 증상·원인을 알아보는 단계
                    (예: &ldquo;허리디스크 초기증상&rdquo;)
                  </li>
                  <li>
                    <span style={{ color: STAGE_META.comparison.color }}>② 비교</span> — 치료법·가격·후기를 비교하는
                    단계 (예: &ldquo;도수치료 가격&rdquo;)
                  </li>
                  <li>
                    <span style={{ color: STAGE_META.decision.color }}>③ 결정</span> — 병원을 고르고 예약하는 단계
                    (예: &ldquo;춘천 정형외과 잘하는 곳&rdquo;)
                  </li>
                  <li>
                    <span style={{ color: STAGE_META.retention.color }}>④ 유지</span> — 치료 후 관리·재방문 단계 (예:
                    &ldquo;시술 후 주의사항&rdquo;)
                  </li>
                </ul>
              </li>
              <li>
                <span className="font-semibold text-slate-600">점수</span> — 공략 가치(0~100). 검색량·구체성이 높고
                리스크가 없을수록 높음. 높은 순으로 콘텐츠를 만들면 됩니다
              </li>
              <li>
                <span className="font-semibold text-slate-600">월 N</span> — 네이버 월간 검색량(PC+모바일 합)
              </li>
              <li>
                <span className="font-semibold text-slate-600">시드/N/G/연관/지식iN/직접</span> — 키워드 출처: 시드=자동
                생성한 출발 키워드, N=네이버 자동완성, G=구글 자동완성, 연관=검색광고 연관키워드(검색량 포함),
                지식iN=실제 환자 질문, 직접=직접 입력
              </li>
              <li>
                <span className="font-semibold text-slate-600">🟡 노란 동그라미</span> — 의료법 <b>주의</b> 표현 포함
                (예: &ldquo;후기&rdquo;). 🔴는 <b>금지</b> 표현. 노드를 클릭하면 사유·대체 표현이 나옵니다
              </li>
              <li>
                <span className="font-semibold text-slate-600">브랜드</span> — 병원명이 들어간 키워드 (굵은 테두리)
              </li>
              <li>
                <span className="font-semibold text-slate-600">AI</span> — AI가 여정 단계를 다시 판별해준 키워드
              </li>
              <li>
                <span className="font-semibold text-slate-600">− / +숫자</span> — 하위 키워드 접기/펼치기 (+숫자 =
                숨겨진 개수)
              </li>
            </ul>
            <p className="mt-2 border-t pt-2 text-[10px] leading-relaxed text-slate-400">
              리스크 안내는 참고용이며 법률 자문을 대체하지 않습니다.
            </p>
          </div>
        </aside>

        <div className="min-w-0 flex-1" ref={flowRef}>
          <ReactFlow
            key={`${riskOnly}-${brandOnly}-${STAGES.map((s) => stageFilter[s]).join("")}`}
            colorMode={colorMode}
            nodes={rfNodes}
            edges={rfEdges}
            nodeTypes={nodeTypes}
            onNodeClick={(_, n) => setSelectedId(n.id)}
            onNodeDoubleClick={(_, n) => {
              const jn = project.nodes.find((x) => x.id === n.id);
              if (!jn || jn.kind !== "keyword") return;
              const kw = prompt("키워드 수정:", jn.keyword);
              if (kw?.trim() && kw.trim() !== jn.keyword) {
                const risk = scanRisk(kw.trim());
                patchNode(jn.id, { keyword: kw.trim(), riskLevel: risk.level, riskReasons: risk.reasons });
              }
            }}
            onNodeDragStop={(_, n) => patchNode(n.id, { position: { x: n.position.x, y: n.position.y } })}
            onPaneClick={() => {
              setSelectedId(null);
              setExportOpen(false);
            }}
            fitView
            minZoom={0.1}
            maxZoom={4}
            proOptions={{ hideAttribution: true }}
          >
            <Background gap={20} color="#e2e8f0" />
            <Controls position="bottom-left" />
            <MiniMap
              position="bottom-right"
              nodeColor={(n) => {
                const jn = (n.data as { jnode?: JNode })?.jnode;
                return jn?.stage ? STAGE_META[jn.stage].color : "#334155";
              }}
            />
          </ReactFlow>
        </div>

        {selectedNode && (
          <DetailPanel
            node={selectedNode}
            regionHint={project.profile.regionSigungu}
            onUpdate={patchNode}
            onAddChild={addChild}
            onDelete={deleteNode}
            onClose={() => setSelectedId(null)}
          />
        )}
      </div>
      )}
    </div>
  );
}
