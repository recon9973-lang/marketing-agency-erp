// GEO Studio · 파이프라인 리포트 — 구조 검증(모든 단계 섹션·핵심 지표 포함).
import { describe, it, expect } from "vitest";
import { runPipeline } from "./pipeline";
import { renderPipelineReport } from "./pipeline-report";

describe("파이프라인 리포트", () => {
  const r = runPipeline({ brand: "베놈한의원", category: "강남 한의원", keywords: ["강남 한의원", "다이어트 한약"], competitors: ["서울메디컬"], budget: 5_000_000 });
  const md = renderPipelineReport(r);

  it("제목과 5단계 섹션을 모두 포함", () => {
    expect(md).toContain("# GEO 진단·실행 리포트 — 베놈한의원");
    for (const h of ["## M1 · AI 인용 스캔", "## M2 · CEP(진입점) 발굴", "## M3 · 콘텐츠 GEO 게이트", "## M4 · 고객 여정 · Topical Authority", "## M5 · 실행 캠페인 계획"]) {
      expect(md).toContain(h);
    }
  });

  it("종합 요약에 각 단계 실제 지표가 반영", () => {
    expect(md).toContain(`| AI 인용율 | ${r.stages.m1.citationRate}% | M1 스캔 |`);
    expect(md).toContain(`${r.stages.m2.cepCoverage}%`);
    expect(md).toContain(`${r.stages.m4.taScore}`);
  });

  it("경쟁사·키워드·진단일 메타 포함", () => {
    expect(md).toContain("경쟁사: 서울메디컬");
    expect(md).toContain("강남 한의원, 다이어트 한약");
    expect(md).toContain(r.scanDate);
  });
});
