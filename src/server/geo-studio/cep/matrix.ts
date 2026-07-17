// GEO Studio · M2 CEP 파인더 — CEP × 콘텐츠 커버리지 매트릭스 (원본 matrix.py 이식).
// 임베딩 유사도로 콘텐츠↔CEP 근접도를 재고 full/partial/none 갭 분류.
import { pyRound } from "../py-compat";
import { cosine } from "./cluster";
import { mockEmbedTexts, DEFAULT_EMBED_DIM } from "./embedding";
import type { Cep } from "./models";

const FULL = 0.82;
const PARTIAL = 0.62;

export type ContentDoc = { url: string; title: string };

export type MatrixCell = {
  cepText: string;
  bestContentUrl: string | null;
  bestContentTitle: string | null;
  coverageScore: number; // 0~1
  gapType: string; // full / partial / none
  matchedCount: number;
};

export function matrixCellToRow(c: MatrixCell): Record<string, unknown> {
  return {
    cep_text: c.cepText,
    best_content_url: c.bestContentUrl,
    best_content_title: c.bestContentTitle,
    coverage_score: c.coverageScore,
    gap_type: c.gapType,
    matched_count: c.matchedCount
  };
}

/** CEP × 콘텐츠 커버리지 매트릭스. (목 임베딩 기준 — 실 임베딩은 P0 주입) */
export function buildMatrix(ceps: Cep[], contents: ContentDoc[], dim: number = DEFAULT_EMBED_DIM): MatrixCell[] {
  if (ceps.length === 0) return [];
  if (contents.length === 0) {
    return ceps.map((c) => ({ cepText: c.cepText, bestContentUrl: null, bestContentTitle: null, coverageScore: 0.0, gapType: "none", matchedCount: 0 }));
  }
  const cepVecs = mockEmbedTexts(ceps.map((c) => c.cepText), dim);
  const docVecs = mockEmbedTexts(contents.map((d) => `${d.title}`), dim);

  const cells: MatrixCell[] = [];
  for (let ci = 0; ci < ceps.length; ci++) {
    const cvec = cepVecs[ci];
    let bestSim = 0.0;
    let bestDoc: ContentDoc | null = null;
    let matched = 0;
    for (let di = 0; di < contents.length; di++) {
      const sim = cosine(cvec, docVecs[di]);
      if (sim >= PARTIAL) matched++;
      if (sim > bestSim) {
        bestSim = sim;
        bestDoc = contents[di];
      }
    }
    const gap = bestSim >= FULL ? "full" : bestSim >= PARTIAL ? "partial" : "none";
    cells.push({
      cepText: ceps[ci].cepText,
      bestContentUrl: bestDoc ? bestDoc.url : null,
      bestContentTitle: bestDoc ? bestDoc.title : null,
      coverageScore: pyRound(bestSim, 3),
      gapType: gap,
      matchedCount: matched
    });
  }
  return cells;
}

export function coverageSummary(cells: MatrixCell[]): Record<string, unknown> {
  const total = cells.length || 1;
  const counts: Record<string, number> = { full: 0, partial: 0, none: 0 };
  for (const cell of cells) counts[cell.gapType]++;
  return {
    total: cells.length,
    counts,
    coverage_rate: pyRound(((counts.full + counts.partial * 0.5) / total) * 100, 1),
    needs_content: cells.filter((c) => c.gapType === "none").map((c) => c.cepText),
    needs_reinforce: cells.filter((c) => c.gapType === "partial").map((c) => c.cepText)
  };
}
