// 마케팅 전략 트랙 — 결정형 엔진 로직 검증(순수 함수). 외부 API 없이 로직 정확성만.
import { describe, it, expect } from "vitest";
import { classifyIntent, buildJourneyFunnel } from "./journey-funnel";
import { buildSeedKeywords } from "./keyword-scan";
import { buildAcquisitionReview, buildConsultingReview } from "./consulting-review";
import type { KeywordScanRow } from "./keyword-scan";

const row = (keyword: string, total: number | null): KeywordScanRow => ({
  keyword, pc: null, mobile: null, total, competition: null, adDepth: null, blogDocs: null, saturation: null, seed: false
});

describe("검색 여정 · classifyIntent", () => {
  it("의도별 단계 분류(덱 여정 예시)", () => {
    expect(classifyIntent("무릎아픈이유")).toBe("문제인식");
    expect(classifyIntent("무릎통증치료")).toBe("정보탐색");
    expect(classifyIntent("정형외과한의원차이")).toBe("비교");
    expect(classifyIntent("강남정형외과예약")).toBe("예약");
    expect(classifyIntent("달서구정형외과")).toBe("병원검토"); // 지역+진료과 로컬 = 검토
  });
});

describe("퍼널 · buildJourneyFunnel", () => {
  const jf = buildJourneyFunnel([
    row("무릎아픈이유", 100), // 문제인식 → 인지
    row("무릎통증치료", 200), // 정보탐색 → 인지
    row("정형외과한의원차이", 50), // 비교 → 고려
    row("강남정형외과예약", 30) // 예약 → 전환
  ]);
  it("여정 → 퍼널 귀속", () => {
    const byFunnel = Object.fromEntries(jf.funnel.map((f) => [f.funnel, f]));
    expect(byFunnel["인지"].searchVolume).toBe(300); // 100+200
    expect(byFunnel["고려"].searchVolume).toBe(50);
    expect(byFunnel["전환"].searchVolume).toBe(30);
  });
  it("퍼널 정의(채널·KPI) 부착", () => {
    const 전환 = jf.funnel.find((f) => f.funnel === "전환")!;
    expect(전환.channels).toContain("네이버 플레이스");
    expect(전환.keywords).toContain("강남정형외과예약");
  });
});

describe("시드 키워드 · buildSeedKeywords", () => {
  it("지역+진료과 결합, 최대 5", () => {
    const seeds = buildSeedKeywords("대구 달서구", "가정의학과");
    expect(seeds[0]).toBe("달서구가정의학과");
    expect(seeds).toContain("달서구다이어트");
    expect(seeds.length).toBeLessThanOrEqual(5);
  });
  it("미매핑 진료과는 병원/의원 폴백", () => {
    const seeds = buildSeedKeywords("서울 강남구", null);
    expect(seeds).toContain("강남구병원");
  });
});

describe("수주 진단 · buildAcquisitionReview", () => {
  const base = {
    hospitalName: "테스트", region: "대구 달서구", specialty: "정형외과",
    populationTotal: 500000, femaleRatio: 50, populationDelta: 100, nationalPer: 10,
    openingsY1: 5, scoreGrade: "B", scoreOverall: 78, incomeIndex: 105, accessLevel: 3,
    accessLabel: "다노선 환승 거점", demandRows: 12
  };
  it("경쟁 과밀(만명당 2배) → 위험 + 차별화 대응", () => {
    const r = buildAcquisitionReview({ ...base, perTenThousand: 25 });
    const comp = r.areas.find((a) => a.key === "competition")!;
    expect(comp.status).toBe("risk");
    expect(r.actions.some((a) => a.title.includes("차별화"))).toBe(true);
  });
  it("경쟁 여유(만명당 0.6배) → 양호 + 선점 대응", () => {
    const r = buildAcquisitionReview({ ...base, perTenThousand: 6 });
    const comp = r.areas.find((a) => a.key === "competition")!;
    expect(comp.status).toBe("good");
    expect(r.actions.some((a) => a.title.includes("선점"))).toBe(true);
  });
  it("scoreOverall → 매력도 tier", () => {
    const r = buildAcquisitionReview({ ...base, perTenThousand: 10, scoreOverall: 80 });
    expect(r.stage).toContain("높음");
  });
});

describe("현황 진단 · buildConsultingReview (신호 없음 정직 강등)", () => {
  it("데이터 공백은 nodata + dataGaps 표기", () => {
    const r = buildConsultingReview({
      hospitalName: "테스트", region: "대구 달서구", departments: [],
      hasChannelData: false, hasRankData: false, totalImpressions: 0, totalVisitors: 0,
      impressionTrend: null, visitorTrend: null, rankAvg: null, rankNetDelta: null,
      trackedKeywords: 0, coreKeywordCount: 0, relatedCount: 0,
      scoreGrade: null, scoreOverall: null, competitionPer: null, nationalPer: 10,
      openingsY1: null, incomeIndex: null, accessLabel: null, work: null
    });
    expect(r.dataGaps.length).toBeGreaterThan(0);
    expect(r.areas.find((a) => a.key === "exposure")!.status).toBe("nodata");
  });
});
