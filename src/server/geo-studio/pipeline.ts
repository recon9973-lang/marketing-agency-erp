// GEO Studio · 통합 파이프라인 — M1~M5를 end-to-end로 실행.
// 각 단계의 실제 산출물이 다음 단계 입력이 된다(기획안 파이프라인 다이어그램 그대로):
//   M1 스캔(citation_rate) → M2 CEP(coverage/top_ceps) → M3 콘텐츠(GEO 게이트 점수)
//   → M4 여정(topical authority) → M5 캠페인(CurrentState 수급 → 실행계획).
// schema.prisma 무변경, 전부 결정적(목) — 라이브 4-AI는 P0 공용 LLM 레이어에서 주입 예정.
import { pyRound, todayIso } from "./py-compat";
import { scan, scanLive, anyPlatformLive } from "./scanner/scanner";
import { discoverCeps } from "./cep/finder";
import { discoverCepsLive, cepRealConfigured } from "./cep/live-finder";
import { buildBrief } from "./cep/brief";
import { briefToMarkdown, makeCep } from "./cep/models";
import { analyzeGeo } from "./content/analyze";
import { geoScoreToRow } from "./content/models";
import { analyzeJourney, fullReport } from "./path/analyzer";
import { buildCampaign, campaignSummary } from "./campaign";
import { currentState, type GeoGoal } from "./models";

export type PipelineInput = {
  brand: string;
  category: string;
  keywords: string[];
  competitors?: string[];
  budget?: number;
  teamSize?: number;
  deadlineDays?: number;
  targetCitationRate?: number;
};

type CepRow = {
  cep_text: string;
  situation_tag: string;
  emotion_tag: string;
  time_tag: string;
  place_tag: string;
  companion_tag: string;
};

export type PipelineResult = {
  input: PipelineInput;
  scanDate: string;
  stages: {
    m1: { citationRate: number; totalQueries: number; byKeyword: Record<string, number> };
    m2: { totalCeps: number; coveredCeps: number; cepCoverage: number; whitespaceCount: number; topCep: string | null };
    m3: { keyword: string; geoScore: number; blufScore: number; faqScore: number; eeatScore: number; citationScore: number; briefMd: string; passed: boolean };
    m4: { taScore: number; taGrade: string; brandMentionRate: number; totalNodes: number; gapCount: number };
    m5: Record<string, unknown>;
  };
  currentState: ReturnType<typeof currentState>;
  goal: GeoGoal;
  /** 각 단계 데이터 등급 — measured(실측) | demo(목). 미지정=demo. */
  dataTier?: { m1: "measured" | "demo"; m2: "measured" | "demo" };
};

/** M3 GEO 게이트 통과 기준(기획안: 70점 이상이면 발행 가치). */
const GEO_GATE = 70;

type NormInput = {
  brand: string;
  category: string;
  keywords: string[];
  competitors: string[];
  budget: number;
  teamSize: number;
  deadlineDays: number;
  targetCitationRate: number;
  scanDate: string;
};

type M1Shape = { overall_mention_rate: number; total_queries: number; by_keyword: Record<string, number> };
type M2Shape = { total_ceps: number; whitespace_count: number; ceps: CepRow[]; top_ceps: string[] };

function normalizeInput(inp: PipelineInput): NormInput {
  return {
    brand: inp.brand.trim(),
    category: inp.category.trim(),
    keywords: inp.keywords.map((k) => k.trim()).filter(Boolean),
    competitors: (inp.competitors ?? []).map((c) => c.trim()).filter(Boolean),
    budget: inp.budget ?? 5_000_000,
    teamSize: inp.teamSize ?? 3,
    deadlineDays: inp.deadlineDays ?? 90,
    targetCitationRate: inp.targetCitationRate ?? 25,
    scanDate: todayIso()
  };
}

/** 목(결정적) 파이프라인 — 테스트·데모용. 실측은 runPipelineLive. */
export function runPipeline(inp: PipelineInput): PipelineResult {
  const n = normalizeInput(inp);
  const m1 = scan(n.brand, n.keywords, n.competitors, undefined, 3, n.scanDate) as unknown as M1Shape;
  const m2 = discoverCeps(n.brand, n.category, { competitors: n.competitors, extraKeywords: n.keywords }) as unknown as M2Shape;
  return finishPipeline(inp, n, m1, m2);
}

/**
 * 실측 우선 파이프라인 — M1(스캔)·M2(CEP)를 연결된 키로 실측 실행, 미연결이면 목.
 * 각 단계 등급을 dataTier로 반환(화면 정직 표기). M3~M5는 결정적 규칙 계산.
 */
export async function runPipelineLive(inp: PipelineInput): Promise<PipelineResult> {
  const n = normalizeInput(inp);
  const m1Live = anyPlatformLive();
  const m1 = (m1Live
    ? await scanLive(n.brand, n.keywords, n.competitors, undefined, 3, n.scanDate)
    : scan(n.brand, n.keywords, n.competitors, undefined, 3, n.scanDate)) as unknown as M1Shape & { live?: boolean };

  const m2Live = cepRealConfigured();
  const m2 = (m2Live
    ? await discoverCepsLive(n.brand, n.category, { seedKeyword: n.category })
    : discoverCeps(n.brand, n.category, { competitors: n.competitors, extraKeywords: n.keywords })) as unknown as M2Shape & { data_tier?: string };

  const result = finishPipeline(inp, n, m1, m2);
  result.dataTier = {
    m1: m1Live && (m1 as { live?: boolean }).live ? "measured" : "demo",
    m2: m2Live && (m2 as { data_tier?: string }).data_tier === "measured" ? "measured" : "demo"
  };
  return result;
}

function finishPipeline(inp: PipelineInput, n: NormInput, m1: M1Shape, m2: M2Shape): PipelineResult {
  const { brand, category, keywords, budget, teamSize, deadlineDays, targetCitationRate, scanDate } = n;
  const citationRate = m1.overall_mention_rate;
  const totalCeps = m2.total_ceps;
  const coveredCeps = Math.max(0, totalCeps - m2.whitespace_count);
  const cepCoverage = totalCeps ? pyRound((coveredCeps / totalCeps) * 100, 1) : 0;
  const topCepRow = m2.ceps[0] ?? null;

  // ── M3: 최우선 CEP → 콘텐츠 브리프 + GEO 점수(발행 게이트) ──
  const m3Keyword = keywords[0] ?? category;
  let briefMd = "";
  let geo = analyzeGeo("", m3Keyword);
  if (topCepRow) {
    briefMd = briefToMarkdown(
      buildBrief(
        makeCep({
          cepText: topCepRow.cep_text,
          situationTag: topCepRow.situation_tag,
          emotionTag: topCepRow.emotion_tag,
          timeTag: topCepRow.time_tag,
          placeTag: topCepRow.place_tag,
          companionTag: topCepRow.companion_tag
        }),
        "blog",
        brand
      )
    );
    geo = analyzeGeo(briefMd, m3Keyword);
  }
  const geoRow = geoScoreToRow(geo) as { geo_score: number; bluf_score: number; faq_score: number; eeat_score: number; citation_score: number };

  // ── M4: 여정 탐색 + Topical Authority(M2 coverage·M3 점수 수급) ──
  const journey = analyzeJourney(brand, category, { scanDate });
  const m4Full = fullReport(journey, {
    domain: brand,
    coveredCeps,
    totalCeps,
    geoScores: [geoRow.geo_score],
    pillarTopic: category,
    ceps: m2.top_ceps,
    existingTopics: []
  }) as unknown as {
    brand_mention_rate: number;
    total_nodes: number;
    gap_count: number;
    topical_authority: { ta_score: number };
  };
  const taScore = m4Full.topical_authority.ta_score;
  const taGrade = taScore >= 80 ? "A" : taScore >= 60 ? "B" : taScore >= 40 ? "C" : "D";

  // ── M5: CurrentState 수급 → 실행 캠페인 ──
  const current = currentState({ citationRate, cepCoverage, taScore, totalCeps, coveredCeps });
  const goal: GeoGoal = { goalType: "citation_rate", targetValue: targetCitationRate, deadlineDays, budget, teamSize };
  const campaign = buildCampaign(`${brand} GEO 캠페인`, goal, current, category, { startDate: scanDate, priorityCepCount: Math.max(1, totalCeps) });
  const m5 = campaignSummary(campaign, current);

  return {
    input: inp,
    scanDate,
    stages: {
      m1: { citationRate, totalQueries: m1.total_queries, byKeyword: m1.by_keyword },
      m2: { totalCeps, coveredCeps, cepCoverage, whitespaceCount: m2.whitespace_count, topCep: topCepRow?.cep_text ?? null },
      m3: {
        keyword: m3Keyword,
        geoScore: geoRow.geo_score,
        blufScore: geoRow.bluf_score,
        faqScore: geoRow.faq_score,
        eeatScore: geoRow.eeat_score,
        citationScore: geoRow.citation_score,
        briefMd,
        passed: geoRow.geo_score >= GEO_GATE
      },
      m4: {
        taScore,
        taGrade,
        brandMentionRate: m4Full.brand_mention_rate,
        totalNodes: m4Full.total_nodes,
        gapCount: m4Full.gap_count
      },
      m5
    },
    currentState: current,
    goal
  };
}
