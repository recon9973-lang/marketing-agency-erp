"use server";

// SEO 진단 — URL을 VENOM 엔진(단일 정본)으로 실측 진단하고 점수·부족항목(수정안)을 반환.
import { z } from "zod";

import { requireUser, runAction, type ActionResult } from "@/server/actions/_helpers";
import { runSeoAudit, scorePct, SEO_ENGINE_VERSION, type SeoEngineResult } from "@/server/seo-engine";

export async function runSeoDiagnosis(
  input: unknown
): Promise<ActionResult<{ result: SeoEngineResult; score: number; fetchedWith: string; version: string }>> {
  return runAction(async () => {
    await requireUser();
    const p = z.object({ url: z.string().trim().min(3).max(300), keyword: z.string().trim().max(100).optional().nullable() }).safeParse(input);
    if (!p.success) throw new Error("VALIDATION");
    const outcome = await runSeoAudit(p.data.url, p.data.keyword ?? null);
    if (!outcome.ok) throw new Error("SEO_FETCH_FAILED");
    return { result: outcome.result, score: scorePct(outcome.result), fetchedWith: outcome.fetchedWith, version: SEO_ENGINE_VERSION };
  });
}
