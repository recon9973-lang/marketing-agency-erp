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
import { geoRewrite, isAiConfigured } from "@/server/ai/claude";
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
  rewriteTier?: "ai" | "rule"; // ai=Claude 실측 재작성, rule=규칙 폴백
};

/** URL을 크롤링해 본문 텍스트를 추출 — /seo 진단처럼 URL만으로 진단 가능하게. */
async function fetchUrlContent(url: string): Promise<{ text?: string; error?: string }> {
  try {
    const parsed = new URL(url.startsWith("http") ? url : `https://${url}`);
    if (!/^https?:$/.test(parsed.protocol)) return { error: "http/https 주소만 지원합니다." };
    const res = await fetch(parsed.toString(), {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; VenomERP-GEO-Diagnosis)" },
      signal: AbortSignal.timeout(10000),
      redirect: "follow"
    });
    if (!res.ok) return { error: `페이지를 불러오지 못했습니다 (HTTP ${res.status}).` };
    const html = await res.text();
    const text = html
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/&nbsp;/g, " ")
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .replace(/\s{2,}/g, " ")
      .trim();
    if (text.length < 100) return { error: "본문 텍스트를 충분히 추출하지 못했습니다. 본문을 직접 붙여넣어 주세요." };
    return { text: text.slice(0, 50000) };
  } catch {
    return { error: "URL 접속에 실패했습니다. 주소를 확인하거나 본문을 직접 붙여넣어 주세요." };
  }
}

/** useActionState용 — (prevState, formData) → 분석 결과. 네이티브 폼 POST(안정적). */
export async function analyzeContentAction(_prev: ContentAnalysis | null, formData: FormData): Promise<ContentAnalysis> {
  try {
    await requireUser();
    let content = String(formData.get("content") ?? "").slice(0, 50000);
    const keyword = String(formData.get("keyword") ?? "").slice(0, 100).trim();
    const url = String(formData.get("url") ?? "").trim();
    // URL이 입력되면 URL을 우선 사용 — 크롤링해서 본문으로 (SEO 진단과 동일한 URL 진단)
    if (url) {
      const fetched = await fetchUrlContent(url);
      if (fetched.error) return { error: fetched.error };
      content = fetched.text ?? "";
    }
    if (!content.trim()) return { error: "URL을 입력하거나 콘텐츠 본문을 붙여넣으세요." };

    const score = analyzeGeo(content, keyword);
    const eeat = auditEeat(content);
    const faq = generateFaq(content, keyword, 5);
    // 실측 우선 — Claude 키가 있으면 실제 GEO 재작성, 실패/미연결이면 규칙 재작성.
    let rewrite = ruleRewrite(content, keyword);
    let rewriteTier: "ai" | "rule" = "rule";
    if (isAiConfigured()) {
      try {
        rewrite = await geoRewrite(content, keyword);
        rewriteTier = "ai";
      } catch {
        rewriteTier = "rule"; // Claude 실패 → 규칙 폴백(정직 표기)
      }
    }
    const contentPreview = content.trim().slice(0, 200);
    return { keyword, contentPreview, score, eeat, faqItems: faq.items, jsonLd: faq.jsonLd, rewrite, rewriteTier };
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
