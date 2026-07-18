// GEO Studio · M3 콘텐츠 빌더 — GEO 종합 점수 엔진 (원본 scoring.py 규칙 경로 이식).
// 가중치: BLUF 25 · FAQ 25 · 인용가능성 30 · E-E-A-T 15 · 구조화 5.
// 라이브(AI) 인용/E-E-A-T는 P0에서 주입 가능하나, 키 없을 때 규칙 폴백으로 항상 점수 산출.
import { pyRound } from "../py-compat";
import { blufScore } from "./bluf";
import { auditEeat } from "./eeat";
import { normalize, paragraphs, sentences } from "./textutil";
import type { GeoScore } from "./models";

const WEIGHTS: Record<string, number> = { bluf: 0.25, faq_coverage: 0.25, citation_potential: 0.3, eeat: 0.15, structured_data: 0.05 };
const WEIGHT_ORDER = ["bluf", "faq_coverage", "citation_potential", "eeat", "structured_data"];

const FAQ_MARK = /faq|자주\s*묻는|q\s*&\s*a|질문과\s*답/i;
const QA_PAIR = /(?:Q[:.]|질문[:.]|\?\s)/g;
const JSON_LD = /"@type"\s*:\s*"FAQPage"|application\/ld\+json/;

/** FAQ 섹션 존재 + Q&A 쌍 수. */
export function faqCoverageScore(content: string): number {
  const hasSection = FAQ_MARK.test(content);
  const pairs = (content.match(QA_PAIR) ?? []).length;
  const score = (hasSection ? 50 : 0) + Math.min(pairs * 12, 50);
  return Math.min(100, score);
}

/** JSON-LD(FAQPage) 존재 여부. */
export function structuredDataScore(content: string): number {
  return JSON_LD.test(content) ? 100.0 : 0.0;
}

/** AI 없이 단락별 인용 가능성 추정. */
export function heuristicCitation(content: string): number {
  const paras = paragraphs(content).length ? paragraphs(content) : sentences(content);
  if (paras.length === 0) return 0.0;
  const sigs = ["입니다", "됩니다", "%", "란", "이란", "때", "경우"];
  let good = 0;
  for (const p of paras) {
    const n = normalize(p);
    const hasFact = sigs.some((s) => n.includes(s));
    if (hasFact && n.length >= 15 && n.length <= 300) good++;
  }
  return pyRound((good / paras.length) * 100, 1);
}

function suggest(b: Record<string, number>): GeoScore["suggestions"] {
  const out: GeoScore["suggestions"] = [];
  if (b.faq_coverage < 60) out.push({ type: "faq", priority: "high", message: "FAQ 섹션 추가 시 점수 +25 예상" });
  if (b.structured_data === 0) out.push({ type: "structured_data", priority: "high", message: "FAQPage JSON-LD 미적용 — 스키마 삽입 권장" });
  if (b.bluf < 60) out.push({ type: "bluf", priority: "medium", message: "핵심 정의를 첫 문단으로 이동(BLUF)" });
  if (b.eeat < 60) out.push({ type: "eeat", priority: "medium", message: "경험·출처·수치 등 E-E-A-T 신호 보강" });
  if (b.citation_potential < 60) out.push({ type: "citation", priority: "low", message: "단락을 독립 인용 가능한 사실 단위로 분리" });
  return out;
}

/** 종합 GEO 점수 + 개선 제안(규칙 경로, 결정적). */
export function analyzeGeo(content: string, keyword = ""): GeoScore {
  const bluf = blufScore(content, keyword);
  const faq = faqCoverageScore(content);
  const structured = structuredDataScore(content);
  const eeat = auditEeat(content).total;
  const citation = heuristicCitation(content);

  const breakdown: Record<string, number> = { bluf, faq_coverage: faq, citation_potential: citation, eeat, structured_data: structured };
  const total = pyRound(
    WEIGHT_ORDER.reduce((sum, k) => sum + breakdown[k] * WEIGHTS[k], 0),
    1
  );

  return {
    total,
    bluf,
    faqCoverage: faq,
    citationPotential: citation,
    eeat,
    structuredData: structured,
    suggestions: suggest(breakdown)
  };
}
