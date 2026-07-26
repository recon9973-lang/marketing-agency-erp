"use client";

import { memo } from "react";
import { Handle, Position, type Node, type NodeProps } from "@xyflow/react";
import { JNode, STAGE_META } from "@/lib/journeymap/types";

export type KeywordNodeData = {
  jnode: JNode;
  hiddenCount: number;
  hasChildren: boolean;
  onToggleCollapse: (id: string) => void;
  [key: string]: unknown;
};

export type KeywordFlowNode = Node<KeywordNodeData, "jnode">;

function KeywordNodeInner({ data, selected }: NodeProps<KeywordFlowNode>) {
  const n = data.jnode;
  const stageColor = n.stage ? STAGE_META[n.stage].color : "#334155";
  const stageLight = n.stage ? STAGE_META[n.stage].light : "#f1f5f9";

  if (n.kind === "center") {
    return (
      <div className="rounded-2xl bg-slate-900 px-6 py-3 text-white shadow-lg" style={{ minWidth: 180 }}>
        <Handle type="source" position={Position.Right} className="!bg-slate-400" />
        <p className="text-center text-base font-bold">{n.keyword}</p>
        <p className="text-center text-[10px] text-slate-300">메인 키워드</p>
      </div>
    );
  }

  if (n.kind === "branch") {
    return (
      <div className="rounded-xl px-4 py-2 font-bold text-white shadow" style={{ background: stageColor, minWidth: 130 }}>
        <Handle type="target" position={Position.Left} className="!bg-white" />
        <Handle type="source" position={Position.Right} className="!bg-white" />
        <div className="flex items-center justify-between gap-2">
          <span className="text-sm">{n.keyword}</span>
          {data.hasChildren && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                data.onToggleCollapse(n.id);
              }}
              className="rounded bg-white/20 px-1.5 text-xs hover:bg-white/40"
              title={n.collapsed ? "펼치기" : "접기"}
            >
              {n.collapsed ? `+${data.hiddenCount}` : "−"}
            </button>
          )}
        </div>
      </div>
    );
  }

  const fontSize = n.score >= 70 ? 14 : n.score >= 40 ? 13 : 12;
  const totalVolume = n.volumePc != null || n.volumeMo != null ? (n.volumePc ?? 0) + (n.volumeMo ?? 0) : null;
  return (
    <div
      className="relative rounded-lg border-2 bg-white px-3 py-1.5 shadow-sm transition"
      style={{
        borderColor: n.isBrand ? "#0f172a" : selected ? stageColor : stageLight,
        background: selected ? stageLight : "#ffffff",
        borderWidth: n.isBrand ? 3 : 2,
      }}
    >
      <Handle type="target" position={Position.Left} style={{ background: stageColor }} />
      <Handle type="source" position={Position.Right} style={{ background: stageColor }} />
      {n.riskLevel !== "none" && (
        <span
          className="absolute -left-2 -top-2 flex h-5 w-5 items-center justify-center rounded-full text-[10px] shadow"
          style={{ background: n.riskLevel === "red" ? "#fee2e2" : "#fef9c3" }}
          title={n.riskLevel === "red" ? "의료법 금지 표현" : "의료법 주의 표현"}
        >
          {n.riskLevel === "red" ? "🔴" : "🟡"}
        </span>
      )}
      <div className="flex items-center gap-1.5">
        <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: stageColor }} />
        <span style={{ fontSize }} className="whitespace-nowrap font-medium">
          {n.keyword}
        </span>
        {data.hasChildren && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              data.onToggleCollapse(n.id);
            }}
            className="ml-1 rounded border px-1 text-[10px] text-slate-400 hover:bg-slate-100"
          >
            {n.collapsed ? `+${data.hiddenCount}` : "−"}
          </button>
        )}
      </div>
      <div className="mt-0.5 flex gap-2 text-[9px] text-slate-400">
        <span>점수 {n.score}</span>
        {totalVolume != null && <span className="font-semibold text-slate-500">월 {totalVolume >= 10000 ? `${(totalVolume / 10000).toFixed(1)}만` : totalVolume.toLocaleString()}</span>}
        <span>
          {n.source === "naver_ac"
            ? "N"
            : n.source === "google_ac"
            ? "G"
            : n.source === "naver_kin"
            ? "지식iN"
            : n.source === "naver_rel"
            ? "연관"
            : n.source === "seed"
            ? "시드"
            : "직접"}
        </span>
        {n.aiCorrected && <span className="text-violet-500">AI</span>}
        {n.isBrand && <span className="font-bold text-slate-700">브랜드</span>}
      </div>
    </div>
  );
}

export const KeywordNode = memo(KeywordNodeInner);
