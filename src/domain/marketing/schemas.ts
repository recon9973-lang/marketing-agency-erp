// src/domain/marketing/schemas.ts
//
// VME 도메인 상수·검증 스키마·파이프라인 상태머신(순수 로직).
// Prisma 모델(docs/venom-marketing-engine-schema.prisma)의 enum과 1:1 대응.
// 런타임 부작용 없음. zod는 ERP 기존 의존성(zod ^3.24) 재사용.

import { z } from "zod";

// ─────────────────────────────────────────────
// 상수 (Prisma enum과 동기화)
// ─────────────────────────────────────────────

export const CONTENT_TYPES = ["BLOG_POST", "SNS_POST", "CARD_NEWS", "SHORT_VIDEO", "REVIEW_GUIDE"] as const;
export type ContentType = (typeof CONTENT_TYPES)[number];

export const PIPELINE_STAGES = [
  "RESEARCH",
  "DRAFTING",
  "COMPLIANCE_REVIEW",
  "READY",
  "SCHEDULED",
  "PUBLISHED",
  "FAILED",
] as const;
export type PipelineStage = (typeof PIPELINE_STAGES)[number];

export const COMPLIANCE_VERDICTS = ["PENDING", "PASS", "WARN", "BLOCK"] as const;
export type ComplianceVerdict = (typeof COMPLIANCE_VERDICTS)[number];

export const PUBLISH_CHANNELS = ["NAVER_BLOG", "WORDPRESS", "INSTAGRAM", "PLACE", "OTHER"] as const;
export type PublishChannel = (typeof PUBLISH_CHANNELS)[number];

// ─────────────────────────────────────────────
// 파이프라인 상태머신
// ─────────────────────────────────────────────

/**
 * 허용된 스테이지 전이. 잘못된 순서(예: 검수 전 발행)를 서버 액션 이전에 차단.
 * 컴플라이언스 게이트: COMPLIANCE_REVIEW → READY 는 verdict가 BLOCK이 아닐 때만(별도 가드).
 */
export const STAGE_TRANSITIONS: Record<PipelineStage, PipelineStage[]> = {
  RESEARCH: ["DRAFTING", "FAILED"],
  DRAFTING: ["COMPLIANCE_REVIEW", "FAILED"],
  COMPLIANCE_REVIEW: ["READY", "DRAFTING", "FAILED"], // 반려 시 DRAFTING으로 되돌림
  READY: ["SCHEDULED", "PUBLISHED", "FAILED"],
  SCHEDULED: ["PUBLISHED", "FAILED", "READY"], // 예약 취소 시 READY
  PUBLISHED: [],
  FAILED: ["DRAFTING", "RESEARCH"], // 재시도
};

export function canTransition(from: PipelineStage, to: PipelineStage): boolean {
  return STAGE_TRANSITIONS[from]?.includes(to) ?? false;
}

/** 발행 가능 여부: READY/SCHEDULED 이고 컴플라이언스가 BLOCK이 아니어야 함. */
export function canPublish(stage: PipelineStage, verdict: ComplianceVerdict): boolean {
  const stageOk = stage === "READY" || stage === "SCHEDULED";
  return stageOk && verdict !== "BLOCK" && verdict !== "PENDING";
}

// ─────────────────────────────────────────────
// 입력 검증 스키마 (server action 경계에서 사용)
// ─────────────────────────────────────────────

export const keywordResearchInput = z.object({
  clientId: z.string().min(1),
  workItemId: z.string().min(1).optional(),
  seedKeyword: z.string().trim().min(1, "키워드를 입력하세요").max(100),
  timeUnit: z.enum(["date", "week", "month"]).default("month"),
});
export type KeywordResearchInput = z.infer<typeof keywordResearchInput>;

export const blogDraftInput = z.object({
  clientId: z.string().min(1),
  workItemId: z.string().min(1).optional(),
  keyword: z.string().trim().min(1).max(100),
  audience: z.string().trim().max(200).optional(),
  referenceUrls: z.array(z.string().url()).max(10).default([]),
  notes: z.string().max(2000).optional(),
  medical: z.boolean().default(false),
});
export type BlogDraftInput = z.infer<typeof blogDraftInput>;

export const creativeInput = z.object({
  clientId: z.string().min(1),
  contentAssetId: z.string().min(1).optional(),
  prompt: z.string().trim().min(1).max(1000),
  kind: z.enum(["image", "short_video", "card_news"]).default("image"),
  aspectRatio: z.enum(["1:1", "9:16", "16:9", "4:5"]).default("1:1"),
});
export type CreativeInput = z.infer<typeof creativeInput>;

export const publishJobInput = z.object({
  contentAssetId: z.string().min(1),
  channel: z.enum(PUBLISH_CHANNELS),
  clientAccountId: z.string().min(1).optional(),
  scheduledAt: z.string().datetime().optional(),
});
export type PublishJobInput = z.infer<typeof publishJobInput>;

export const rankCheckInput = z.object({
  clientId: z.string().min(1),
  reportId: z.string().min(1).optional(),
  keywords: z.array(z.string().trim().min(1)).min(1).max(50),
  target: z.string().trim().min(1),
  channel: z.enum(["blog", "web", "local"]).default("blog"),
});
export type RankCheckInput = z.infer<typeof rankCheckInput>;
