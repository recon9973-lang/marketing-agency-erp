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
// 저장: clientId 제공 시 ContentAsset 모델에 결과를 저장한다(마이그레이션 완료).

import { db } from "@/server/db";
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
  savedId?: string; // ContentAsset record id (clientId 제공 시)
};

/**
 * 블로그 초안 파이프라인 실행.
 * @param raw 검증 전 입력(blogDraftInput 스키마로 파싱: clientId, workItemId, keyword, medical 등).
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

  let result: DraftPipelineResult;

  // 비의료 주제: 검수 게이트 없이 READY.
  if (!input.medical) {
    result = { ok: true, stage: "READY", draft };
  } else {
    // 의료 주제: 의료광고법 검수 게이트.
    const compliance = reviewMedicalCompliance(collectComplianceText(draft));
    if (compliance.verdict === "BLOCK") {
      result = { ok: false, stage: "COMPLIANCE_REVIEW", draft, compliance };
    } else {
      result = { ok: true, stage: "READY", draft, compliance };
    }
  }

  // ContentAsset 저장 (clientId 제공 시)
  if (input.clientId) {
    try {
      const complianceVerdict = result.compliance
        ? (result.compliance.verdict as "PASS" | "WARN" | "BLOCK")
        : input.medical
          ? "PENDING"
          : "PASS";

      const saved = await db.contentAsset.create({
        data: {
          clientId: input.clientId,
          workItemId: input.workItemId ?? null,
          type: "BLOG_POST",
          stage: result.stage,
          title: draft.recommendedTitle ?? null,
          bodyMarkdown: draft.bodyMarkdown ?? null,
          meta: {
            metaDescription: draft.metaDescription,
            titleCandidates: draft.titleCandidates,
            faq: draft.faq,
            keyword: input.keyword,
            audience: input.audience,
          } as never,
          complianceVerdict: complianceVerdict as never,
          complianceNotes:
            result.compliance?.findings?.map((f) => f.message).join("\n") ?? null,
        },
        select: { id: true },
      });
      result.savedId = saved.id;
    } catch (err) {
      // DB 저장 실패 시 결과는 반환(dev 환경 DB 없는 경우 등)
      result.error = result.error ?? `persist:${(err as Error).message?.slice(0, 60)}`;
    }
  }

  return result;
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
