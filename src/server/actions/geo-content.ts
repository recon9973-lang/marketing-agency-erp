// GEO Studio · M3 콘텐츠 빌더 — 서버 액션(규칙 분석 + 진단 저장).
// 콘텐츠 → GEO 점수·E-E-A-T·FAQ(JSON-LD)·BLUF 재작성. 라이브 AI 정교화는 P0에서 주입.
"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireUser, runAction, type ActionResult } from "@/server/actions/_helpers";
import { getDefaultOrgId } from "@/server/org";
import { db } from "@/server/db";
import { analyzeGeo } from "@/server/geo-studio/content/analyze";
import { generateFaq } from "@/server/geo-studio/content/faq";
import { auditEeat } from "@/server/geo-studio/content/eeat";
import { ruleRewrite } from "@/server/geo-studio/content/bluf";
import type { GeoScore, EeatReport, FaqItem } from "@/server/geo-studio/content/models";

export type ContentAnalysis = {
  error?: string;
  keyword?: string;
  contentPreview?: string;
  score?: GeoScore;
  eeat?: EeatReport;
  faqItems?: FaqItem[];
  jsonLd?: string;
  rewrite?: string;
};

/** useActionState용 — (prevState, formData) → 분석 결과. 네이티브 폼 POST(안정적). */
export async function analyzeContentAction(_prev: ContentAnalysis | null, formData: FormData): Promise<ContentAnalysis> {
  try {
    await requireUser();
    const content = String(formData.get("content") ?? "").slice(0, 50000);
    const keyword = String(formData.get("keyword") ?? "").slice(0, 100).trim();
    if (!content.trim()) return { error: "콘텐츠를 입력하세요." };

    const score = analyzeGeo(content, keyword);
    const eeat = auditEeat(content);
    const faq = generateFaq(content, keyword, 5);
    const rewrite = ruleRewrite(content, keyword);
    const contentPreview = content.trim().slice(0, 200);
    return { keyword, contentPreview, score, eeat, faqItems: faq.items, jsonLd: faq.jsonLd, rewrite };
  } catch {
    return { error: "분석 중 오류가 발생했습니다." };
  }
}

const saveSchema = z.object({
  keyword: z.string().max(100).optional().nullable(),
  contentPreview: z.string().max(500).optional().nullable(),
  scoreTotal: z.number().int().min(0).max(100),
  rewrite: z.string().max(20000).optional().nullable(),
  result: z.unknown()
});

/** 분석 결과(state)를 진단 이력으로 저장. */
export async function saveContentDiagnosis(input: unknown): Promise<ActionResult<{ id: string }>> {
  return runAction(async () => {
    const user = await requireUser();
    const p = saveSchema.safeParse(input);
    if (!p.success) throw new Error("VALIDATION");
    const d = p.data;
    const orgId = await getDefaultOrgId();
    const saved = await db.geoContentDiagnosis.create({
      data: {
        orgId,
        keyword: (d.keyword || "").slice(0, 100),
        contentPreview: (d.contentPreview || "").slice(0, 500),
        scoreTotal: d.scoreTotal,
        rewrite: (d.rewrite || "").slice(0, 20000),
        result: (d.result ?? {}) as object,
        createdById: user.id
      }
    });
    revalidatePath("/geo-content");
    return { id: saved.id };
  });
}

/** 저장된 진단 삭제(작성자 본인만). */
export async function deleteContentDiagnosis(input: unknown): Promise<ActionResult> {
  return runAction(async () => {
    const user = await requireUser();
    const p = z.object({ id: z.string().min(1) }).safeParse(input);
    if (!p.success) throw new Error("VALIDATION");
    const row = await db.geoContentDiagnosis.findUnique({ where: { id: p.data.id }, select: { createdById: true } });
    if (!row) throw new Error("NOT_FOUND");
    if (row.createdById !== user.id) throw new Error("FORBIDDEN");
    await db.geoContentDiagnosis.delete({ where: { id: p.data.id } });
    revalidatePath("/geo-content");
  });
}
