// GEO CEP · GPT 리뷰 합성 구조 테스트.
import { describe, it, expect } from "vitest";
import { buildGptReview, type ReviewReport } from "./review";

const report: ReviewReport = {
  total_ceps: 4,
  whitespace_count: 1,
  candidate_count: 20,
  probe_count: 8,
  ceps: [
    { cep_text: "혼자 조용히 쉬기 좋은 햇살숙소", situation_tag: "힐링", emotion_tag: "안정", priority_score: 90, ai_mention_count: 2, is_whitespace: false },
    { cep_text: "가성비 좋은 햇살숙소", situation_tag: "가성비", emotion_tag: "실속", priority_score: 70, ai_mention_count: 1, is_whitespace: false },
    { cep_text: "특별한 기념일에 어울리는 햇살숙소", situation_tag: "기념일", emotion_tag: "기대감", priority_score: 60, ai_mention_count: 0, is_whitespace: true },
    { cep_text: "혼자 힐링하기 좋은 숙소", situation_tag: "힐링", emotion_tag: "안정", priority_score: 50, ai_mention_count: 1, is_whitespace: false }
  ]
};

describe("buildGptReview", () => {
  const r = buildGptReview(report, "햇살숙소", "제주 숙소");

  it("종합 분석 4개 섹션이 채워짐", () => {
    expect(r.overview.keywordAnalysis).toContain("제주 숙소");
    expect(r.overview.serpAnalysis).toContain("햇살숙소");
    expect(r.overview.cepAnalysis.length).toBeGreaterThan(0);
    expect(r.overview.strategy).toContain("게이트");
  });

  it("페르소나는 상황그룹 상위 3개(중복 그룹 병합)", () => {
    expect(r.personas.length).toBeLessThanOrEqual(3);
    // 힐링 그룹이 점수합 최상위 → 첫 페르소나.
    expect(r.personas[0].name).toContain("휴식");
    expect(r.personas[0].questions.length).toBeGreaterThan(0);
  });

  it("자사 언급 비율 = 언급 진입점/전체", () => {
    expect(r.brandMention.coveredRate).toBe(75); // 4개 중 3개 언급
    expect(r.brandMention.whitespaceRate).toBe(25); // 4개 중 1개 화이트스페이스
  });
});
