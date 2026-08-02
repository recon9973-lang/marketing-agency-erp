"use client";

// PAA 스냅샷 결과 화면 — 인포그래픽 대시보드 + NotebookLM 풍 마인드맵 + 원고 초안 생성
// (journeymap 단독판 이식, @xyflow/react v12)

import dagre from "dagre";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { memo, useCallback, useEffect, useMemo, useState } from "react";
import {
  Background,
  Controls,
  Handle,
  Position,
  ReactFlow,
  ReactFlowProvider,
  type Edge,
  type Node,
  type NodeProps,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";

import { exportPaaCalendar } from "@/lib/journeymap/export";
import {
  AnalyzeResponse,
  PaaCategory,
  PaaQuestion,
  PaaTree,
  treeToProject,
} from "@/lib/journeymap/paa";
import { scanRisk } from "@/lib/journeymap/risk";
import { uid, useProjectStore } from "@/lib/journeymap/store";
import { RiskLevel, Stage, STAGE_META } from "@/lib/journeymap/types";

// dataviz 검증 팔레트 (라이트 서페이스, 순서 고정)
const CAT_COLORS = ["#2a78d6", "#eb6834", "#1baf7a", "#eda100", "#e87ba4", "#008300", "#4a3aa7", "#e34948"];
const STATUS = { critical: "#d03b3b" };
const SEQ_BLUE = "#2a78d6";
// 텍스트 잉크는 인라인 hex 대신 slate 클래스 사용 — ERP 전역 다크 브리지(globals.css)가 자동 반전.

// ERP 테마(data-theme)와 캔버스 다크모드 동기화 — 기존 map/[id] 페이지와 같은 패턴
function useColorMode(): "light" | "dark" {
  const [colorMode, setColorMode] = useState<"light" | "dark">("light");
  useEffect(() => {
    const el = document.documentElement;
    const update = () => setColorMode(el.getAttribute("data-theme") === "dark" ? "dark" : "light");
    update();
    const obs = new MutationObserver(update);
    obs.observe(el, { attributes: true, attributeFilter: ["data-theme"] });
    return () => obs.disconnect();
  }, []);
  return colorMode;
}

interface SnapshotDetail {
  snapshotId: string;
  createdAt: string;
  query: string;
  region: string | null;
  topic: string | null;
  advertiser: string | null;
  rawCount: number;
  tree: PaaTree;
}

type MindNodeData = {
  label: string;
  kind: "center" | "category" | "question";
  color: string;
  stage?: Stage;
  isLocal?: boolean;
  qSource?: "naver" | "google";
  risk?: RiskLevel;
  collapsed?: boolean;
  childCount?: number;
  onToggle?: () => void;
  [key: string]: unknown;
};

type MindFlowNode = Node<MindNodeData, "mind">;

function MindNodeInner({ data }: NodeProps<MindFlowNode>) {
  if (data.kind === "center") {
    return (
      <div className="rounded-2xl bg-slate-900 px-6 py-3.5 text-white shadow-lg dark:ring-1 dark:ring-slate-500">
        <Handle type="source" position={Position.Right} className="!bg-slate-400" />
        <p className="text-base font-bold">{data.label}</p>
      </div>
    );
  }
  if (data.kind === "category") {
    return (
      <div
        className="rounded-xl px-4 py-2.5 shadow-sm"
        style={{ background: `${data.color}1a`, border: `1.5px solid ${data.color}` }}
      >
        <Handle type="target" position={Position.Left} style={{ background: data.color }} />
        <Handle type="source" position={Position.Right} style={{ background: data.color }} />
        <div className="flex items-center gap-2">
          <span className="text-sm font-bold" style={{ color: data.color }}>
            {data.label}
          </span>
          <button
            onClick={(e) => {
              e.stopPropagation();
              data.onToggle?.();
            }}
            className="rounded-full px-1.5 text-xs font-bold text-white"
            style={{ background: data.color }}
            title={data.collapsed ? "펼치기" : "접기"}
          >
            {data.collapsed ? `+${data.childCount}` : "−"}
          </button>
        </div>
        {data.stage && (
          <p className="mt-0.5 text-[10px] font-semibold" style={{ color: STAGE_META[data.stage].color }}>
            {STAGE_META[data.stage].label}
          </p>
        )}
      </div>
    );
  }
  return (
    <div
      className="relative max-w-[320px] rounded-xl border bg-white px-3.5 py-2 shadow-sm"
      style={{ borderColor: `${data.color}66` }}
    >
      <Handle type="target" position={Position.Left} style={{ background: data.color }} />
      {data.risk && data.risk !== "none" && (
        <span
          className="absolute -left-2 -top-2 flex h-5 w-5 items-center justify-center rounded-full text-[10px] shadow"
          style={{ background: data.risk === "red" ? "#fee2e2" : "#fef9c3" }}
          title={data.risk === "red" ? "의료법 금지 표현 포함" : "의료법 주의 표현 포함"}
        >
          {data.risk === "red" ? "🔴" : "🟡"}
        </span>
      )}
      <p className="text-[13px] leading-snug text-slate-900">{data.label}</p>
      {(data.isLocal || data.qSource === "google") && (
        <p className="mt-0.5 flex gap-2 text-[10px] font-semibold">
          {data.isLocal && <span className="text-emerald-700">📍 지역 질문</span>}
          {data.qSource === "google" && <span className="text-blue-600">G 구글</span>}
        </p>
      )}
    </div>
  );
}
const MindNode = memo(MindNodeInner);
const nodeTypes = { mind: MindNode };

function questionSize(text: string): { width: number; height: number } {
  const width = Math.min(320, Math.max(200, text.length * 7.5 + 40));
  const lines = Math.ceil((text.length * 7.5) / (width - 28));
  return { width, height: 26 + lines * 18 };
}

function buildFlow(
  tree: PaaTree,
  collapsed: Set<number>,
  toggle: (i: number) => void
): { nodes: MindFlowNode[]; edges: Edge[] } {
  const g = new dagre.graphlib.Graph();
  g.setGraph({ rankdir: "LR", nodesep: 12, ranksep: 80, marginx: 30, marginy: 30 });
  g.setDefaultEdgeLabel(() => ({}));

  interface Item {
    id: string;
    data: MindNodeData;
    size: { width: number; height: number };
    parentId: string | null;
  }
  const items: Item[] = [
    {
      id: "center",
      parentId: null,
      size: { width: Math.max(160, tree.name.length * 15 + 60), height: 56 },
      data: { label: tree.name, kind: "center", color: "#0f172a" },
    },
  ];

  tree.categories.forEach((cat, i) => {
    const color = CAT_COLORS[i % CAT_COLORS.length];
    const catId = `c${i}`;
    items.push({
      id: catId,
      parentId: "center",
      size: { width: Math.max(150, cat.name.length * 13 + 70), height: 58 },
      data: {
        label: cat.name,
        kind: "category",
        color,
        stage: cat.stage,
        collapsed: collapsed.has(i),
        childCount: cat.questions.length,
        onToggle: () => toggle(i),
      },
    });
    if (!collapsed.has(i)) {
      cat.questions.forEach((q, j) => {
        const risk = scanRisk(q.text);
        items.push({
          id: `q${i}_${j}`,
          parentId: catId,
          size: questionSize(q.text),
          data: { label: q.text, kind: "question", color, isLocal: q.isLocal, qSource: q.source, risk: risk.level },
        });
      });
    }
  });

  for (const it of items) g.setNode(it.id, it.size);
  for (const it of items) if (it.parentId) g.setEdge(it.parentId, it.id);
  dagre.layout(g);

  const nodes: MindFlowNode[] = items.map((it) => {
    const pos = g.node(it.id);
    return {
      id: it.id,
      type: "mind" as const,
      position: { x: pos.x - it.size.width / 2, y: pos.y - it.size.height / 2 },
      data: it.data,
      draggable: true,
    };
  });
  const edges: Edge[] = items
    .filter((it) => it.parentId)
    .map((it) => ({
      id: `e_${it.parentId}_${it.id}`,
      source: it.parentId!,
      target: it.id,
      type: "default",
      style: { stroke: it.data.color, strokeWidth: 2, opacity: 0.55 },
    }));
  return { nodes, edges };
}

function StatTile({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-2xl border bg-white p-4 shadow-sm">
      <p className="text-xs text-slate-400">{label}</p>
      <p className="mt-1 text-2xl font-bold text-slate-900">{value}</p>
      {sub && <p className="mt-0.5 text-[11px] text-slate-500">{sub}</p>}
    </div>
  );
}

function HBar({ label, value, max, color }: { label: string; value: number; max: number; color: string }) {
  const pct = max > 0 ? (value / max) * 100 : 0;
  return (
    <div className="group flex items-center gap-2 py-1" title={`${label}: ${value}개`}>
      <span className="w-40 truncate text-right text-xs text-slate-500">{label}</span>
      <div className="relative h-4 flex-1 overflow-hidden rounded bg-slate-100">
        <div
          className="h-full transition-opacity group-hover:opacity-80"
          style={{ width: `${pct}%`, background: color, borderRadius: "0 4px 4px 0" }}
        />
      </div>
      <span className="w-10 text-xs font-semibold tabular-nums text-slate-900">{value}</span>
    </div>
  );
}

function Donut({ localCount, generalCount }: { localCount: number; generalCount: number }) {
  const total = localCount + generalCount;
  const localPct = total > 0 ? localCount / total : 0;
  const r = 40;
  const c = 2 * Math.PI * r;
  return (
    <div className="flex items-center gap-5">
      <svg width="110" height="110" viewBox="0 0 110 110" role="img" aria-label="지역·일반 질문 비율">
        <circle cx="55" cy="55" r={r} fill="none" stroke="#eb6834" strokeWidth="16" />
        <circle
          cx="55"
          cy="55"
          r={r}
          fill="none"
          stroke={SEQ_BLUE}
          strokeWidth="16"
          strokeDasharray={`${c * localPct} ${c}`}
          strokeLinecap={localPct > 0 && localPct < 1 ? "round" : "butt"}
          transform="rotate(-90 55 55)"
        />
        <text
          x="55"
          y="52"
          textAnchor="middle"
          fontSize="18"
          fontWeight="700"
          fill="currentColor"
          className="text-slate-900"
        >
          {Math.round(localPct * 100)}%
        </text>
        <text x="55" y="68" textAnchor="middle" fontSize="9" fill="currentColor" className="text-slate-400">
          지역 질문
        </text>
      </svg>
      <div className="space-y-1.5 text-xs">
        <p className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm" style={{ background: SEQ_BLUE }} />
          <span className="text-slate-500">지역 질문</span>
          <b className="tabular-nums text-slate-900">{localCount}개</b>
        </p>
        <p className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm" style={{ background: "#eb6834" }} />
          <span className="text-slate-500">일반 질문</span>
          <b className="tabular-nums text-slate-900">{generalCount}개</b>
        </p>
        <p className="pt-1 text-[10px] text-slate-400">지역 → 플레이스·랜딩 / 일반 → 블로그</p>
      </div>
    </div>
  );
}

export default function PaaSnapshotPage() {
  return (
    <ReactFlowProvider>
      <SnapshotInner />
    </ReactFlowProvider>
  );
}

function SnapshotInner() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { addProject } = useProjectStore();
  const colorMode = useColorMode();
  const [snap, setSnap] = useState<SnapshotDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState<Set<number>>(new Set());
  const [selectedQ, setSelectedQ] = useState<{ category: PaaCategory; question: PaaQuestion } | null>(null);
  const [draftLoading, setDraftLoading] = useState(false);
  const [draft, setDraft] = useState<{
    text: string;
    riskHits: { line: string; level: string; description: string }[];
  } | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`/api/journeymap/paa/snapshots/${id}`);
        const data = await res.json();
        if (!res.ok) setError(data.error || "스냅샷을 불러올 수 없습니다.");
        else setSnap(data);
      } catch {
        setError("서버 요청에 실패했습니다.");
      }
    })();
  }, [id]);

  const toggle = useCallback((i: number) => {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      return next;
    });
  }, []);

  const stats = useMemo(() => {
    if (!snap) return null;
    const questions = snap.tree.categories.flatMap((c) => c.questions.map((q) => ({ ...q, stage: c.stage })));
    const risks = questions.map((q) => scanRisk(q.text).level);
    const stageCount: Record<Stage, number> = { exploration: 0, comparison: 0, decision: 0, retention: 0 };
    for (const q of questions) stageCount[q.stage]++;
    return {
      total: questions.length,
      localCount: questions.filter((q) => q.isLocal).length,
      generalCount: questions.filter((q) => !q.isLocal).length,
      red: risks.filter((r) => r === "red").length,
      yellow: risks.filter((r) => r === "yellow").length,
      stageCount,
      catCounts: snap.tree.categories.map((c) => ({ name: c.name, count: c.questions.length })),
    };
  }, [snap]);

  const flow = useMemo(
    () => (snap ? buildFlow(snap.tree, collapsed, toggle) : { nodes: [] as MindFlowNode[], edges: [] as Edge[] }),
    [snap, collapsed, toggle]
  );

  const generateDraft = useCallback(async () => {
    if (!snap || !selectedQ) return;
    setDraftLoading(true);
    setDraft(null);
    try {
      const res = await fetch("/api/journeymap/paa/draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question: selectedQ.question.text,
          category: selectedQ.category.name,
          isLocal: selectedQ.question.isLocal,
          query: snap.query,
          advertiser: snap.advertiser || "",
        }),
      });
      const data = await res.json();
      if (!res.ok) setDraft({ text: `⚠️ ${data.error || "초안 생성에 실패했습니다."}`, riskHits: [] });
      else setDraft({ text: data.draft, riskHits: data.riskHits || [] });
    } catch {
      setDraft({ text: "⚠️ 서버 요청에 실패했습니다.", riskHits: [] });
    } finally {
      setDraftLoading(false);
    }
  }, [snap, selectedQ]);

  const openJourneyMap = useCallback(() => {
    if (!snap) return;
    const projectId = uid("paa");
    addProject(
      treeToProject(
        snap as Pick<AnalyzeResponse, "query" | "region" | "topic" | "tree" | "createdAt"> & {
          advertiser?: string | null;
        },
        projectId
      )
    );
    router.push(`/journeymap/map/${projectId}`);
  }, [snap, addProject, router]);

  if (error) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3">
        <p className="text-sm text-red-600">⚠️ {error}</p>
        <Link href="/journeymap/paa" className="text-sm text-blue-600 underline">
          ← 목록으로
        </Link>
      </div>
    );
  }
  if (!snap || !stats) {
    return <div className="flex min-h-screen items-center justify-center text-sm text-slate-400">불러오는 중…</div>;
  }

  const maxCat = Math.max(...stats.catCounts.map((c) => c.count), 1);
  const maxStage = Math.max(...Object.values(stats.stageCount), 1);
  const STAGES_ORDER: Stage[] = ["exploration", "comparison", "decision", "retention"];

  return (
    <div className="flex h-[calc(100vh-0px)] flex-col bg-slate-50">
      <header className="flex flex-wrap items-center gap-3 border-b bg-white px-5 py-3">
        <Link href="/journeymap/paa" className="text-sm text-slate-500 hover:text-slate-900">
          ← 목록
        </Link>
        <h1 className="font-bold">{snap.query}</h1>
        {snap.advertiser && <span className="text-sm text-slate-400">× {snap.advertiser}</span>}
        <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs text-slate-500">
          {new Date(snap.createdAt).toLocaleDateString("ko-KR")} 수집
        </span>
        {snap.region && (
          <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-700">
            📍 {snap.region}
          </span>
        )}
        {snap.tree.expanded && snap.tree.expanded.length > 0 && (
          <span
            className="rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-semibold text-amber-700"
            title="이 지역만으로는 질문이 적어 상위 지역 질문을 함께 수집했습니다"
          >
            🔎 {snap.tree.expanded.join(" · ")} 범위 확장 수집
          </span>
        )}
        <button
          onClick={() => exportPaaCalendar(snap.tree, snap.query)}
          className="ml-auto rounded-lg bg-emerald-600 px-3.5 py-1.5 text-sm font-semibold text-white hover:bg-emerald-700"
          title="주차별 발행 계획 + 채널 자동 배정 + 의료법 리스크가 담긴 엑셀(CSV)"
        >
          📅 콘텐츠 캘린더 CSV
        </button>
        <button
          onClick={openJourneyMap}
          className="rounded-lg border px-3.5 py-1.5 text-sm font-semibold text-slate-600 hover:bg-slate-50"
          title="편집·필터·내보내기가 있는 기존 검색여정 지도로 엽니다"
        >
          🗺️ 검색여정 지도로 편집
        </button>
      </header>

      {/* 인포그래픽 대시보드 */}
      <div className="grid shrink-0 grid-cols-2 gap-3 border-b bg-slate-50 p-4 lg:grid-cols-4">
        <StatTile label="정제된 환자 질문" value={`${stats.total}개`} sub={`원시 수집 ${snap.rawCount}건에서 정제`} />
        <div className="rounded-2xl border bg-white p-4 shadow-sm">
          <p className="text-xs text-slate-400">지역 질문 비율</p>
          <div className="mt-1">
            <Donut localCount={stats.localCount} generalCount={stats.generalCount} />
          </div>
        </div>
        <div className="rounded-2xl border bg-white p-4 shadow-sm">
          <p className="mb-1.5 text-xs text-slate-400">검색여정 단계 분포</p>
          {STAGES_ORDER.map((s) => (
            <HBar key={s} label={STAGE_META[s].label} value={stats.stageCount[s]} max={maxStage} color={STAGE_META[s].color} />
          ))}
        </div>
        <div className="rounded-2xl border bg-white p-4 shadow-sm">
          <p className="mb-1.5 text-xs text-slate-400">의료법 리스크</p>
          <div className="flex items-center gap-4">
            <p className="text-2xl font-bold text-slate-900" style={stats.red > 0 ? { color: STATUS.critical } : undefined}>
              {stats.red + stats.yellow}건
            </p>
            <div className="space-y-0.5 text-xs text-slate-500">
              <p>
                <span style={{ color: STATUS.critical }}>🔴 금지 표현</span> {stats.red}건
              </p>
              <p>
                <span style={{ color: "#a16207" }}>🟡 주의 표현</span> {stats.yellow}건
              </p>
            </div>
          </div>
          <p className="mt-1.5 text-[10px] text-slate-400">참고용 안내 — 법률 자문을 대체하지 않습니다</p>
        </div>
      </div>

      {/* 카테고리 분포 */}
      <details className="shrink-0 border-b bg-white px-5 py-2 text-sm">
        <summary className="cursor-pointer text-xs font-semibold text-slate-500">📊 카테고리별 질문 수 펼쳐보기</summary>
        <div className="max-w-2xl py-2">
          {stats.catCounts.map((c, i) => (
            <HBar key={c.name} label={c.name} value={c.count} max={maxCat} color={CAT_COLORS[i % CAT_COLORS.length]} />
          ))}
        </div>
      </details>

      {/* NotebookLM 풍 마인드맵 + 초안 패널 */}
      <div className="relative min-h-0 flex-1">
        <ReactFlow
          nodes={flow.nodes}
          edges={flow.edges}
          nodeTypes={nodeTypes}
          colorMode={colorMode}
          onNodeClick={(_, node) => {
            const m = node.id.match(/^q(\d+)_(\d+)$/);
            if (!m || !snap) return;
            const category = snap.tree.categories[Number(m[1])];
            const question = category?.questions[Number(m[2])];
            if (category && question) {
              setSelectedQ({ category, question });
              setDraft(null);
              setCopied(false);
            }
          }}
          fitView
          minZoom={0.1}
          maxZoom={3}
          proOptions={{ hideAttribution: true }}
        >
          <Background gap={24} color={colorMode === "dark" ? "#334155" : "#e2e8f0"} />
          <Controls position="bottom-left" />
        </ReactFlow>
        <p className="pointer-events-none absolute left-3 top-3 rounded-md bg-white/95 px-2.5 py-1 text-[11px] text-slate-500 shadow-sm">
          💡 질문 카드를 클릭하면 블로그 초안을 만들 수 있습니다
        </p>

        {selectedQ && (
          <aside className="absolute inset-y-0 right-0 z-10 flex w-[400px] flex-col border-l bg-white shadow-xl">
            <div className="flex items-start justify-between gap-2 border-b p-4">
              <div>
                <p className="text-[11px] font-semibold" style={{ color: STAGE_META[selectedQ.category.stage].color }}>
                  {STAGE_META[selectedQ.category.stage].label} · {selectedQ.category.name}
                  {selectedQ.question.isLocal && <span className="ml-1 text-emerald-600">📍 지역</span>}
                </p>
                <p className="mt-1 text-sm font-bold leading-snug">{selectedQ.question.text}</p>
              </div>
              <button onClick={() => setSelectedQ(null)} className="rounded p-1 text-slate-400 hover:bg-slate-100">
                ✕
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto p-4">
              {!draft && !draftLoading && (
                <div className="text-center">
                  <p className="mb-3 text-xs text-slate-500">
                    이 질문에 답하는 의료광고법 준수 원고 초안을 AI 가 작성합니다.
                    <br />
                    생성 후 기존 리스크 엔진으로 자동 재검수합니다.
                  </p>
                  <button
                    onClick={generateDraft}
                    className="rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-700"
                  >
                    ✍️ 블로그 초안 생성
                  </button>
                </div>
              )}
              {draftLoading && <p className="py-8 text-center text-sm text-blue-600">🔄 초안 작성 중… (10~20초)</p>}
              {draft && (
                <div>
                  {draft.riskHits.length > 0 ? (
                    <div className="mb-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
                      <p className="mb-1 font-bold">⚠️ 리스크 재검수: {draft.riskHits.length}건 발견 — 게재 전 수정 필요</p>
                      {draft.riskHits.slice(0, 4).map((h, i) => (
                        <p key={i}>
                          • &ldquo;{h.line}&rdquo; — {h.description}
                        </p>
                      ))}
                    </div>
                  ) : draft.text.startsWith("⚠️") ? null : (
                    <p className="mb-3 rounded-lg border border-emerald-200 bg-emerald-50 p-2.5 text-xs font-semibold text-emerald-700">
                      ✅ 리스크 재검수 통과 — 금지·주의 표현 없음
                    </p>
                  )}
                  <pre className="whitespace-pre-wrap rounded-lg bg-slate-50 p-3 font-sans text-[13px] leading-relaxed text-slate-800">
                    {draft.text}
                  </pre>
                  {!draft.text.startsWith("⚠️") && (
                    <div className="mt-3 flex gap-2">
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(draft.text);
                          setCopied(true);
                        }}
                        className="rounded-lg bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-700"
                      >
                        {copied ? "✅ 복사됨" : "📋 원고 복사"}
                      </button>
                      <button
                        onClick={generateDraft}
                        className="rounded-lg border px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50"
                      >
                        🔄 다시 생성
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
            <p className="border-t px-4 py-2 text-[10px] leading-relaxed text-slate-400">
              초안은 참고용입니다. 게재 전 의료광고 심의 기준과 병원 사실관계(비급여 고지 등)를 반드시 확인하세요.
            </p>
          </aside>
        )}
      </div>
    </div>
  );
}
