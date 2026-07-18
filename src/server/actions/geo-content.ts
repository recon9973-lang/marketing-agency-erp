// GEO Studio · M3 콘텐츠 빌더 — 서버 액션(규칙 분석, DB 미저장).
// 콘텐츠 → GEO 점수·E-E-A-T·FAQ(JSON-LD)·BLUF 재작성. 라이브 AI 정교화는 P0에서 주입.
"use server";

import { requireUser } from "@/server/actions/_helpers";
import { analyzeGeo } from "@/server/geo-studio/content/analyze";
import { generateFaq } from "@/server/geo-studio/content/faq";
import { auditEeat } from "@/server/geo-studio/content/eeat";
import { ruleRewrite } from "@/server/geo-studio/content/bluf";
import type { GeoScore, EeatReport, FaqItem } from "@/server/geo-studio/content/models";

export type ContentAnalysis = {
  error?: string;
  keyword?: string;
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
    return { keyword, score, eeat, faqItems: faq.items, jsonLd: faq.jsonLd, rewrite };
  } catch {
    return { error: "분석 중 오류가 발생했습니다." };
  }
}
