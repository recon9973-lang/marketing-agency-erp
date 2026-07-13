// 카드뉴스 자동 분할 — 긴 글을 여러 장의 카드로 나눈다(규칙 기반, 순수 함수).
// 문단·문장 경계를 존중하며 페이지당 글자 예산으로 그리디 패킹한다. DOM 무관 → 서버/클라 공용.
import { makeId, type StudioDoc, type StudioElement, type StudioPage } from "@/domain/studio/schema";

export type AutoPaginateOptions = {
  width?: number;
  height?: number;
  charBudget?: number; // 페이지당 목표 글자 수(본문)
  cover?: boolean; // 첫 장을 표지로
  title?: string; // 표지 제목(없으면 첫 문장에서 추출)
};

const BRAND = "#d9662e";
const INK = "#17171b";
const WHITE = "#ffffff";
const MUTED = "#4b5563";

// 문장 단위로 분해 — 줄바꿈을 우선 존중하고, 각 줄을 문장 종결부호로 다시 쪼갠다.
function splitSentences(text: string): string[] {
  const out: string[] = [];
  for (const rawLine of text.replace(/\r\n/g, "\n").split("\n")) {
    const line = rawLine.trim();
    if (!line) continue;
    const matches = line.match(/[^.!?。…]+[.!?。…]*\s*/g);
    if (matches) out.push(...matches.map((s) => s.trim()).filter(Boolean));
    else out.push(line);
  }
  return out;
}

// 예산보다 긴 단일 문장은 길이로 강제 분할(공백 우선).
function hardWrap(sentence: string, budget: number): string[] {
  if (sentence.length <= budget) return [sentence];
  const parts: string[] = [];
  let rest = sentence;
  while (rest.length > budget) {
    let cut = rest.lastIndexOf(" ", budget);
    if (cut < budget * 0.5) cut = budget; // 공백이 너무 앞이면 그냥 자름
    parts.push(rest.slice(0, cut).trim());
    rest = rest.slice(cut).trim();
  }
  if (rest) parts.push(rest);
  return parts;
}

// 문장들을 페이지 글자 예산으로 그리디 패킹.
function packPages(sentences: string[], budget: number): string[] {
  const pages: string[] = [];
  let cur = "";
  for (const s of sentences) {
    for (const chunk of hardWrap(s, budget)) {
      if (!cur) cur = chunk;
      else if (cur.length + 1 + chunk.length <= budget) cur = `${cur} ${chunk}`;
      else {
        pages.push(cur);
        cur = chunk;
      }
    }
  }
  if (cur) pages.push(cur);
  return pages;
}

function coverPage(width: number, height: number, title: string): StudioPage {
  const elements: StudioElement[] = [
    { id: makeId("sh"), type: "rect", x: width * 0.11, y: height * 0.35, width: 120, height: 14, rotation: 0, opacity: 1, locked: false, fill: BRAND, cornerRadius: 8, stroke: null, strokeWidth: 0 },
    { id: makeId("tx"), type: "text", x: width * 0.09, y: height * 0.39, width: width * 0.82, height: height * 0.28, rotation: 0, opacity: 1, locked: false, text: title, fontSize: Math.round(width * 0.085), fontFamily: "Pretendard, sans-serif", fill: WHITE, align: "left", fontStyle: "bold", lineHeight: 1.15, letterSpacing: 0 }
  ];
  return { id: makeId("pg"), width, height, background: INK, elements };
}

function bodyPage(width: number, height: number, index: number, body: string): StudioPage {
  const elements: StudioElement[] = [
    { id: makeId("tx"), type: "text", x: width * 0.09, y: height * 0.09, width: width * 0.3, height: height * 0.1, rotation: 0, opacity: 1, locked: false, text: String(index).padStart(2, "0"), fontSize: Math.round(width * 0.1), fontFamily: "Pretendard, sans-serif", fill: BRAND, align: "left", fontStyle: "bold", lineHeight: 1.1, letterSpacing: 0 },
    { id: makeId("sh"), type: "rect", x: width * 0.09, y: height * 0.24, width: width * 0.82, height: 4, rotation: 0, opacity: 1, locked: false, fill: "#ececed", cornerRadius: 0, stroke: null, strokeWidth: 0 },
    { id: makeId("tx"), type: "text", x: width * 0.09, y: height * 0.29, width: width * 0.82, height: height * 0.6, rotation: 0, opacity: 1, locked: false, text: body, fontSize: Math.round(width * 0.041), fontFamily: "Pretendard, sans-serif", fill: MUTED, align: "left", fontStyle: "normal", lineHeight: 1.5, letterSpacing: 0 }
  ];
  return { id: makeId("pg"), width, height, background: WHITE, elements };
}

/** 긴 글 → 카드뉴스 문서. 표지(선택) + 본문 N장. */
export function autopaginate(text: string, opts: AutoPaginateOptions = {}): StudioDoc {
  const width = opts.width ?? 1080;
  const height = opts.height ?? 1350;
  const budget = opts.charBudget ?? 200;
  const withCover = opts.cover ?? true;

  const sentences = splitSentences(text);
  const bodyPages = packPages(sentences, budget);
  const title = (opts.title?.trim() || sentences[0] || "카드뉴스").slice(0, 60);

  const pages: StudioPage[] = [];
  if (withCover) pages.push(coverPage(width, height, title));
  bodyPages.forEach((body, i) => pages.push(bodyPage(width, height, i + 1, body)));
  if (pages.length === 0) pages.push(bodyPage(width, height, 1, text.slice(0, budget) || "내용을 입력하세요"));

  return { version: 1, pages };
}
