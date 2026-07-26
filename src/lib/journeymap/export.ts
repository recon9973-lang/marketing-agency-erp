"use client";

import { toPng, toSvg } from "html-to-image";
import { JNode, Project, STAGE_META } from "./types";

function download(dataUrl: string, filename: string) {
  const a = document.createElement("a");
  a.href = dataUrl;
  a.download = filename;
  a.click();
}

function downloadBlob(content: string, mime: string, filename: string) {
  const blob = new Blob(["﻿" + content], { type: mime });
  const url = URL.createObjectURL(blob);
  download(url, filename);
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

export async function exportPng(el: HTMLElement, filename: string, scale = 2) {
  const dataUrl = await toPng(el, {
    backgroundColor: "#ffffff",
    pixelRatio: scale,
    filter: (node) => !node.classList?.contains("react-flow__minimap") && !node.classList?.contains("react-flow__controls"),
  });
  download(dataUrl, filename);
}

export async function exportSvg(el: HTMLElement, filename: string) {
  const dataUrl = await toSvg(el, {
    backgroundColor: "#ffffff",
    filter: (node) => !node.classList?.contains("react-flow__minimap") && !node.classList?.contains("react-flow__controls"),
  });
  download(dataUrl, filename);
}

export function exportCsv(project: Project) {
  const header = ["키워드", "여정단계", "심도", "출처", "월간검색량PC", "월간검색량MO", "CPC(원)", "경쟁도", "S_intent점수", "리스크", "브랜드키워드", "리스크사유"];
  const rows = project.nodes
    .filter((n) => n.kind === "keyword")
    .map((n) => [
      n.keyword,
      n.stage ? STAGE_META[n.stage].label : "-",
      String(n.depth),
      n.source,
      n.volumePc != null ? String(n.volumePc) : "-",
      n.volumeMo != null ? String(n.volumeMo) : "-",
      n.cpc != null ? String(n.cpc) : "-",
      n.competition ?? "-",
      String(n.score),
      n.riskLevel === "red" ? "🔴 금지" : n.riskLevel === "yellow" ? "🟡 주의" : "-",
      n.isBrand ? "O" : "",
      n.riskReasons.map((r) => `${r.law}: ${r.description}`).join(" / "),
    ]);
  const csv = [header, ...rows]
    .map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(","))
    .join("\n");
  downloadBlob(csv, "text/csv;charset=utf-8", `journeymap_${project.mainKeyword}.csv`);
}

export function exportJson(project: Project) {
  const tree = {
    version: "1.0",
    project: {
      main_keyword: project.mainKeyword,
      hospital: project.profile.name,
      generated_at: new Date(project.updatedAt).toISOString(),
    },
    nodes: project.nodes.map((n: JNode) => ({
      id: n.id,
      parent_id: n.parentId,
      keyword: n.keyword,
      depth: n.depth,
      journey_stage: n.stage,
      volume: { pc: n.volumePc ?? null, mo: n.volumeMo ?? null },
      cpc: n.cpc ?? null,
      competition: n.competition ?? null,
      intent_score: n.score,
      risk: { level: n.riskLevel, reasons: n.riskReasons },
      source: n.source,
      is_brand: n.isBrand,
    })),
  };
  downloadBlob(JSON.stringify(tree, null, 2), "application/json", `journeymap_${project.mainKeyword}.json`);
}
