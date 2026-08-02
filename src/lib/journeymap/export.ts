"use client";

import { toPng, toSvg } from "html-to-image";
import { getNodesBounds, type Node as RFNode } from "@xyflow/react";
import { PaaTree } from "./paa";
import { scanRisk } from "./risk";
import { JNode, Project, Stage, STAGE_META } from "./types";

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

// ── 이미지 내보내기 — 화면에 보이는 부분이 아니라 "노드 전체 범위"를 캡처한다.
// 컨테이너를 그대로 찍으면 화면 밖 노드가 잘리므로, 노드 좌표 전체 경계를 계산해
// 그 크기의 캔버스에 viewport를 재배치(translate·zoom 1)해서 찍는다.
const EXPORT_PADDING = 48;
const MAX_PIXELS = 16000; // 브라우저 캔버스 한계 보호 — 초과 시 배율 자동 축소

function fullBounds(flowEl: HTMLElement, rfNodes: RFNode[]) {
  const viewportEl = flowEl.querySelector(".react-flow__viewport") as HTMLElement | null;
  if (!viewportEl || rfNodes.length === 0) return null;
  const b = getNodesBounds(rfNodes);
  const width = Math.ceil(b.width + EXPORT_PADDING * 2);
  const height = Math.ceil(b.height + EXPORT_PADDING * 2);
  const transform = `translate(${-b.x + EXPORT_PADDING}px, ${-b.y + EXPORT_PADDING}px) scale(1)`;
  return { viewportEl, width, height, transform };
}

export async function exportPng(flowEl: HTMLElement, rfNodes: RFNode[], filename: string, scale = 2) {
  const full = fullBounds(flowEl, rfNodes);
  if (!full) return;
  const safeScale = Math.min(scale, MAX_PIXELS / Math.max(full.width, full.height));
  const dataUrl = await toPng(full.viewportEl, {
    backgroundColor: "#ffffff",
    pixelRatio: safeScale,
    width: full.width,
    height: full.height,
    style: { width: `${full.width}px`, height: `${full.height}px`, transform: full.transform },
  });
  download(dataUrl, filename);
}

export async function exportSvg(flowEl: HTMLElement, rfNodes: RFNode[], filename: string) {
  const full = fullBounds(flowEl, rfNodes);
  if (!full) return;
  const dataUrl = await toSvg(full.viewportEl, {
    backgroundColor: "#ffffff",
    width: full.width,
    height: full.height,
    style: { width: `${full.width}px`, height: `${full.height}px`, transform: full.transform },
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

// ── PAA 콘텐츠 캘린더 — 지역/일반 + 여정 단계 기준 채널 자동 배정 (journeymap 단독판 이식)
function paaChannelFor(stage: Stage, isLocal: boolean): { channel: string; guide: string } {
  if (isLocal) {
    return {
      channel: "네이버 플레이스 · 지역 랜딩페이지",
      guide: "지역명을 제목과 본문에 자연스럽게 포함하고, 플레이스 FAQ·예약 링크와 연결하세요.",
    };
  }
  switch (stage) {
    case "exploration":
      return {
        channel: "블로그 정보성 원고",
        guide: "원리·증상을 쉬운 언어로 설명하고 핵심 요약 3줄을 글 상단에 배치하세요 (FAQ 스키마 연동).",
      };
    case "comparison":
      return {
        channel: "블로그 비교·FAQ 원고",
        guide: "객관적 기준(재료·수명·관리)을 표로 정리하고, 비용은 비급여 고지 형태로만 안내하세요.",
      };
    case "decision":
      return {
        channel: "플레이스 FAQ · 상담 안내",
        guide: "상담·예약 절차와 준비물을 안내하고, 의료진 정보는 과장 없이 객관적으로 제공하세요.",
      };
    case "retention":
      return {
        channel: "인스타그램 카드뉴스 · 숏폼",
        guide: "회복 일정·주의사항을 카드형 시각 자료로 정리해 직관적으로 전달하세요.",
      };
  }
}

export function exportPaaCalendar(tree: PaaTree, query: string) {
  const header = ["발행 주차", "여정 단계", "카테고리", "환자 질문", "질문 유형", "추천 채널", "실행 가이드", "의료법 리스크"];
  const rows: string[][] = [];
  let week = 1;
  for (const cat of tree.categories) {
    for (const q of cat.questions) {
      const { channel, guide } = paaChannelFor(cat.stage, q.isLocal);
      const risk = scanRisk(q.text);
      rows.push([
        `${week}주차`,
        STAGE_META[cat.stage].label,
        cat.name,
        q.text,
        q.isLocal ? "지역 질문" : "일반 질문",
        channel,
        guide,
        risk.level === "red"
          ? `🔴 금지: ${risk.reasons.map((r) => r.description).join(" / ")}`
          : risk.level === "yellow"
            ? `🟡 주의: ${risk.reasons.map((r) => r.description).join(" / ")}`
            : "-",
      ]);
      week++;
    }
  }
  const csv = [header, ...rows]
    .map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(","))
    .join("\n");
  downloadBlob(csv, "text/csv;charset=utf-8", `PAA_콘텐츠캘린더_${query}.csv`);
}
