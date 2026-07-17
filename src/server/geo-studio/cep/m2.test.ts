// GEO Studio · M2 CEP 파인더 — 결정적 알고리즘 골든 테스트(파이썬 동등성).
// 픽스처는 원본 cep_finder를 고정 입력으로 실행해 생성(RNG 목 응답은 제외 — dev 전용).
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { describe, it, expect } from "vitest";

import { buildProbes, buildProbesMulti } from "./probes";
import { extractCandidates } from "./extract";
import { mockEmbedding, mockEmbedTexts } from "./embedding";
import { cosine, clusterCandidates, dedupClusters } from "./cluster";
import { tagCluster, representativeText } from "./tagging";
import { priorityScore, isWhitespace } from "./scoring";
import { buildCompetitorMap, competitorToRow, shareOfCeps, whitespaceCeps, overlapCeps } from "./competitors";
import { buildMatrix, matrixCellToRow, coverageSummary } from "./matrix";
import { buildBrief } from "./brief";
import { candidateToRow, makeCep, briefToMarkdown, type CepCandidate, type ContentBrief } from "./models";

const g = JSON.parse(readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), "__fixtures__/m2.golden.json"), "utf8"));

const cand = (text: string, sourceAi: string, competitorsMentioned: string[] = [], brandMentioned = false): CepCandidate => ({
  text,
  sourceAi,
  keyword: "k",
  probe: "p",
  brandMentioned,
  competitorsMentioned
});

function briefToRow(b: ContentBrief): Record<string, unknown> {
  return {
    cep_text: b.cepText,
    content_type: b.contentType,
    working_title: b.workingTitle,
    target_persona: b.targetPersona,
    search_intent: b.searchIntent,
    key_messages: b.keyMessages,
    outline: b.outline,
    seo_keywords: b.seoKeywords,
    tone: b.tone,
    recommended_channel: b.recommendedChannel,
    cta: b.cta
  };
}

describe("M2 · 프로브", () => {
  it("build_probes(제주 숙소,4) = 26개", () => expect(buildProbes("제주 숙소", 4)).toEqual(g.probes));
  it("build_probes_multi 개수", () => expect(buildProbesMulti("제주 숙소", ["제주 펜션"], 4).length).toBe(g.probes_multi_count));
});

describe("M2 · 맥락 추출", () => {
  const AI_TEXT =
    "질문하신 내용에 대해 상황별로 추천드립니다.\n" +
    "1. 아이와 함께 가기 좋은 햇살숙소 — 해당 맥락에서 평판이 좋습니다.\n" +
    "2. 혼자 조용히 쉬기 좋은 블루하우스 — 힐링에 좋습니다.\n" +
    "3. 주말 나들이로 딱인 코지스테이 — 가족 단위로 인기입니다.\n" +
    "방문 전 예약 가능 여부와 이용 시간을 확인하세요.";
  it("extract_candidates → 3건(브랜드/경쟁사 태깅)", () => {
    const cands = extractCandidates({ platform: "chatgpt", text: AI_TEXT }, "제주 숙소", "프로브", "햇살숙소", ["블루하우스", "코지스테이"]);
    expect(cands.map(candidateToRow)).toEqual(g.extract);
  });
});

describe("M2 · 임베딩·클러스터", () => {
  const CT = [
    "아이와 함께 가기 좋은 제주 숙소",
    "아이랑 같이 가기 좋은 제주 펜션",
    "혼자 조용히 쉬기 좋은 제주 숙소",
    "혼자 힐링하기 좋은 제주 펜션",
    "주말 나들이로 딱인 제주 숙소",
    "주말에 가기 좋은 제주 리조트",
    "가성비 뛰어난 제주 숙소",
    "가성비 좋은 제주 펜션"
  ];
  it("mock 임베딩 코사인 = 파이썬 동일", () => {
    expect(cosine(mockEmbedding("아이와 함께 가기 좋은 제주 숙소"), mockEmbedding("아이랑 같이 가기 좋은 제주 펜션"))).toBe(g.embed_cosine[0]);
    expect(cosine(mockEmbedding("아이와 함께 가기 좋은 제주 숙소"), mockEmbedding("가성비 뛰어난 제주 숙소"))).toBe(g.embed_cosine[1]);
  });
  it("cluster+dedup 멤버 구성 동일", () => {
    const cands = CT.map((t) => cand(t, "chatgpt"));
    const vecs = mockEmbedTexts(CT);
    const clusters = dedupClusters(clusterCandidates(cands, vecs, 3), 0.92);
    expect(clusters.map((c) => c.members.map((m) => m.text))).toEqual(g.clusters);
  });
});

describe("M2 · 태깅·점수화", () => {
  const TT = ["아이와 함께 가기 좋은 제주 숙소 주말에 힐링", "혼자 조용히 쉬기 좋은 서울 근처 펜션"];
  it("tag_cluster", () => expect(tagCluster(TT)).toEqual(g.tag_cluster));
  it("representative_text", () => expect(representativeText(TT)).toBe(g.representative));
  it("priority_score", () => {
    expect(priorityScore(3, 1, 2, { mentionCeiling: 3, competitorCeiling: 2, keywordCeiling: 4 })).toBe(g.scoring[0]);
    expect(priorityScore(0, 0, 1, { mentionCeiling: 1, competitorCeiling: 1, keywordCeiling: 1 })).toBe(g.scoring[1]);
    expect(priorityScore(5, 3, 3, { mentionCeiling: 5, competitorCeiling: 5, keywordCeiling: 5 })).toBe(g.scoring[2]);
  });
  it("is_whitespace", () => {
    expect([isWhitespace(0, 0), isWhitespace(1, 0), isWhitespace(0, 2)]).toEqual(g.is_whitespace);
  });
});

describe("M2 · 경쟁사 맵", () => {
  const cep0 = makeCep({ cepText: "아이와 함께 가기 좋은 제주 숙소" });
  const mem = [
    cand("t1", "chatgpt", ["블루하우스"]),
    cand("t2", "gemini", ["블루하우스", "코지스테이"]),
    cand("t3", "chatgpt", ["코지스테이"]),
    cand("t4", "claude", [])
  ];
  it("build_competitor_map", () => expect(buildCompetitorMap(cep0, mem).map(competitorToRow)).toEqual(g.competitor_map));
  const ceps2 = [
    makeCep({ cepText: "a", competitorNames: ["블루하우스"], brandMentionCount: 1 }),
    makeCep({ cepText: "b", isWhitespace: true }),
    makeCep({ cepText: "c", competitorNames: ["코지스테이", "블루하우스"], brandMentionCount: 2 })
  ];
  it("share_of_ceps", () => expect(shareOfCeps(ceps2, ["블루하우스", "코지스테이"])).toEqual(g.share));
  it("whitespace/overlap", () => {
    expect(whitespaceCeps(ceps2).map((c) => c.cepText)).toEqual(g.whitespace);
    expect(overlapCeps(ceps2).map((c) => c.cepText)).toEqual(g.overlap);
  });
});

describe("M2 · 매트릭스·브리프", () => {
  it("build_matrix + coverage_summary", () => {
    const mceps = [makeCep({ cepText: "아이와 함께 가기 좋은 제주 숙소" }), makeCep({ cepText: "가성비 뛰어난 제주 펜션" })];
    const docs = [{ url: "/a", title: "아이와 함께 제주 숙소 추천" }, { url: "/b", title: "서울 맛집 리스트" }];
    const cells = buildMatrix(mceps, docs);
    expect(cells.map(matrixCellToRow)).toEqual(g.matrix);
    expect(coverageSummary(cells)).toEqual(g.coverage);
  });
  it("build_brief + to_markdown", () => {
    const bcep = makeCep({ cepText: "아이와 함께 가기 좋은 제주 숙소", emotionTag: "힐링", timeTag: "주말", placeTag: "서울", companionTag: "아이 동반" });
    const br = buildBrief(bcep, "blog", "햇살숙소");
    expect(briefToRow(br)).toEqual(g.brief);
    expect(briefToMarkdown(br)).toBe(g.brief_md);
  });
});
