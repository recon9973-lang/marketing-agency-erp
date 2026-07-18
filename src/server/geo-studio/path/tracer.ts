// GEO Studio · M4 Path Analyzer — AI 인용 소스 역추적 (원본 tracer.py 이식, 분류·요약).
import { pyRound } from "../py-compat";
import type { SourceTrace } from "./models";

/** URL → 도메인(netloc, www. 제거·소문자). */
export function urlDomain(url: string): string {
  try {
    return new URL(url).host.replaceAll("www.", "").toLowerCase();
  } catch {
    return "";
  }
}

/** 인용 URL을 자사/경쟁사 도메인으로 분류. */
export function classify(urls: string[], ownDomains: string[], competitorDomains: string[]): { own: string[]; comp: string[] } {
  const ownSet = ownDomains.map((d) => d.replaceAll("www.", "").toLowerCase());
  const compSet = competitorDomains.map((d) => d.replaceAll("www.", "").toLowerCase());
  const own: string[] = [];
  const comp: string[] = [];
  for (const u of urls) {
    const d = urlDomain(u);
    if (ownSet.some((o) => d === o || d.endsWith("." + o))) own.push(u);
    else if (compSet.some((c) => d === c || d.endsWith("." + c))) comp.push(u);
  }
  return { own, comp };
}

/** 역추적 요약: 자사/경쟁 인용 비중 + 대체 소스. */
export function summarizeTraces(traces: SourceTrace[]): Record<string, unknown> {
  const total = traces.length || 1;
  const ownCited = traces.filter((t) => t.ownUrls.length > 0).length;
  const compCited = traces.filter((t) => t.competitorUrls.length > 0).length;
  const displaced = traces.filter((t) => t.competitorUrls.length > 0 && t.ownUrls.length === 0).map((t) => t.aiSource);
  const allComp = [...new Set(traces.flatMap((t) => t.competitorUrls))].sort();
  return {
    ai_count: traces.length,
    own_citation_rate: pyRound((ownCited / total) * 100, 1),
    competitor_citation_rate: pyRound((compCited / total) * 100, 1),
    displaced_by_competitor: displaced,
    all_competitor_urls: allComp
  };
}
