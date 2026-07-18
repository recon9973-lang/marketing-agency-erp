// GEO Studio · M4 Path Analyzer — 결정적 코어 골든 테스트(파이썬 동등성).
// 고정 여정 트리로 gaps·authority·clusters·tracer·models 검증. 목 explorer는 구조/결정성 테스트.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { describe, it, expect } from "vitest";

import { makeNode, treeToRow, totalNodes, brandMentionRate, gapNodes, taToRow, clusterPlanToRow, type JourneyTree } from "./models";
import { coverageScore, qualityScore, trustScore, computeTa } from "./authority";
import { analyzeGaps, topPaths } from "./gaps";
import { planClusters, missingClusters, cepItem } from "./clusters";
import { urlDomain, classify, summarizeTraces } from "./tracer";
import { analyzeJourney } from "./analyzer";

const g = JSON.parse(readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), "__fixtures__/m4.golden.json"), "utf8"));

const tree: JourneyTree = {
  brand: "햇살숙소",
  seedQuery: "제주 숙소 추천",
  maxDepth: 2,
  root: makeNode({
    query: "제주 숙소 추천",
    depth: 0,
    brandMentioned: false,
    children: [
      makeNode({ query: "제주 숙소 가격", depth: 1, brandMentioned: true, children: [makeNode({ query: "제주 숙소 가격 비교", depth: 2, brandMentioned: false })] }),
      makeNode({
        query: "제주 숙소 후기",
        depth: 1,
        brandMentioned: false,
        citedUrls: ["https://x.com/1"],
        children: [makeNode({ query: "제주 숙소 후기 위치", depth: 2, brandMentioned: true }), makeNode({ query: "제주 숙소 후기 주차", depth: 2, brandMentioned: false })]
      })
    ]
  })
};

describe("M4 · 여정 모델·갭", () => {
  it("tree_row", () => expect(treeToRow(tree)).toEqual(g.tree_row));
  it("total_nodes / brand_mention_rate", () => {
    expect(totalNodes(tree)).toBe(g.total_nodes);
    expect(brandMentionRate(tree)).toBe(g.brand_mention_rate);
  });
  it("gap_nodes", () => expect(gapNodes(tree).map((n) => n.query)).toEqual(g.gap_nodes));
  it("analyze_gaps", () => {
    const rows = analyzeGaps(tree).map((x) => ({ query: x.query, depth: x.depth, priority: x.priority, child_count: x.childCount, competitor_present: x.competitorPresent }));
    expect(rows).toEqual(g.gaps);
  });
  it("top_paths", () => expect(topPaths(tree, 10)).toEqual(g.top_paths));
});

describe("M4 · Topical Authority", () => {
  it("coverage/quality/trust", () => {
    expect([coverageScore(7, 20), coverageScore(25, 20)]).toEqual(g.coverage);
    expect(qualityScore([72.6, 47.5, 100.0])).toBe(g.quality);
    expect([trustScore(30, 40), trustScore(50, 40)]).toEqual(g.trust);
  });
  it("compute_ta", () => {
    const ta = computeTa({ domain: "seokorea.org", coveredCeps: 11, totalCeps: 20, geoScores: [72.6, 47.5], aiMentionRate: 40.0, topicClusterCount: 15 });
    expect(taToRow(ta)).toEqual(g.ta);
  });
});

describe("M4 · 클러스터 플래너", () => {
  const plan = planClusters(
    "제주 숙소",
    [cepItem("아이와 함께 가기 좋은 제주 숙소", 90), cepItem("혼자 쉬기 좋은 제주 숙소", 70), cepItem("가성비 제주 숙소", 50)],
    ["가성비 제주 숙소 정리"],
    60.0
  );
  it("plan_clusters", () => expect(clusterPlanToRow(plan)).toEqual(g.cluster_plan));
  it("missing_clusters", () => expect(missingClusters(plan).map((c) => c.topic)).toEqual(g.missing));
});

describe("M4 · 소스 트레이서", () => {
  it("domain", () => expect([urlDomain("https://www.blog.naver.com/123"), urlDomain("https://competitor.co.kr/x")]).toEqual(g.domain));
  it("classify", () => {
    const { own, comp } = classify(["https://blog.naver.com/1", "https://sub.competitor.co.kr/2", "https://other.com/3"], ["blog.naver.com"], ["competitor.co.kr"]);
    expect({ own, comp }).toEqual(g.classify);
  });
  it("summarize_traces", () => {
    const traces = [
      { query: "q", aiSource: "chatgpt", citedUrls: ["u1"], ownUrls: ["u1"], competitorUrls: [], brandCited: true },
      { query: "q", aiSource: "gemini", citedUrls: ["u2"], ownUrls: [], competitorUrls: ["u2"], brandCited: false },
      { query: "q", aiSource: "claude", citedUrls: ["u3"], ownUrls: [], competitorUrls: [], brandCited: false }
    ];
    expect(summarizeTraces(traces)).toEqual(g.summarize);
  });
});

describe("M4 · 여정 탐색기(목·구조/결정성)", () => {
  const OPTS = { competitors: ["블루하우스", "코지스테이"], scanDate: "2026-07-17T00:00:00.000Z" };
  const r = analyzeJourney("햇살숙소", "제주 숙소 추천", OPTS);
  it("여정을 실제로 생성", () => {
    expect(r.total_nodes).toBeGreaterThan(1);
    expect(r.tree).toBeTruthy();
    expect(r.brand_mention_rate).toBeGreaterThanOrEqual(0);
    expect(r.top_paths.length).toBeGreaterThan(0);
  });
  it("결정적 — 동일 입력 동일 출력", () => expect(analyzeJourney("햇살숙소", "제주 숙소 추천", OPTS)).toEqual(r));
});
