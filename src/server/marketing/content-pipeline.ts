// src/server/marketing/content-pipeline.ts
//
// S3 · SEO 콘텐츠 파이프라인 오케스트레이터.
// 흐름: 입력검증(zod) → seo-generator 초안 → (의료 주제면) 의료광고법 검수 게이트 → 스테이지/판정.
//
// 컴플라이언스 게이트 규칙:
//   - verdict BLOCK  → 발행 불가. 스테이지 COMPLIANCE_REVIEW에서 정지(사람 수정 필요).
//   - verdict WARN   → READY로 진행하되 findings를 함께 전달(검토 권고).
//   - verdict PASS   → READY.
//
// 저장: ContentAsset 모델은 아직 미마이그레이션이므로 결과를 구조화해 반환한다.
// 호출부(server action/UI)가 ContentAsset 또는 WorkItem에 저장한다(모델 병합 후 이 파일에서 직접 persist 예정).

import { seoGeneratorContent } from "./providers/seo-content";
import { reviewMedicalCompliance, type ComplianceReport } from "./compliance";
import type { BlogDraft } from "./providers/types";
import { blogDraftInput, type PipelineStage } from "@/domain/marketing/schemas";

export type DraftPipelineResult = {
  ok: boolean;
  stage: PipelineStage;
  draft?: BlogDraft;
  compliance?: ComplianceReport;
  error?: string;
};

/**
 * 블로그 초안 파이프라인 실행.
 * @param raw 검증 전 입력(blogDraftInput 스키마로 파싱).
 */
export async function runBlogDraftPipeline(raw: unknown): Promise<DraftPipelineResult> {
  const parsed = blogDraftInput.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, stage: "FAILED", error: "VALIDATION_ERROR" };
  }
  const input = parsed.data;

  const draftRes = await seoGeneratorContent.draftBlogPost(input);
  if (!draftRes.ok) {
    return { ok: false, stage: "FAILED", error: draftRes.error.code };
  }
  const draft = draftRes.data;

  // 비의료 주제: 검수 게이트 없이 READY.
  if (!input.medical) {
    return { ok: true, stage: "READY", draft };
  }

  // 의료 주제: 의료광고법 검수 게이트.
  const compliance = reviewMedicalCompliance(collectComplianceText(draft));
  if (compliance.verdict === "BLOCK") {
    return { ok: false, stage: "COMPLIANCE_REVIEW", draft, compliance };
  }
  return { ok: true, stage: "READY", draft, compliance };
}

/** 검수 대상 텍스트 취합(제목·메타·본문·FAQ). */
function collectComplianceText(d: BlogDraft): string {
  return [
    d.recommendedTitle,
    ...d.titleCandidates,
    d.metaDescription,
    d.bodyMarkdown,
    ...d.faq.flatMap((f) => [f.q, f.a]),
  ]
    .filter(Boolean)
    .join("\n");
}
