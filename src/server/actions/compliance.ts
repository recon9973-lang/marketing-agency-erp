// 목표 경로: src/server/actions/compliance.ts
//
// 의료법 검수 — 원고 텍스트를 규칙엔진으로 1차 검사. 거래처 금지어를 함께 적용.
"use server";

import { z } from "zod";

import { db } from "@/server/db";
import { checkMedicalLaw, type ComplianceResult } from "@/server/compliance/medical-law";
import { requireUser, runAction, type ActionResult } from "@/server/actions/_helpers";

const schema = z.object({
  text: z.string().min(1).max(20000),
  clientId: z.string().optional().nullable()
});

export async function checkContentCompliance(input: unknown): Promise<ActionResult<ComplianceResult>> {
  return runAction(async () => {
    await requireUser();
    const p = schema.safeParse(input);
    if (!p.success) throw new Error("VALIDATION");

    let prohibited: string | null = null;
    if (p.data.clientId) {
      const profile = await db.hospitalProfile.findUnique({
        where: { clientId: p.data.clientId },
        select: { prohibitedClaims: true }
      });
      prohibited = profile?.prohibitedClaims ?? null;
    }

    return checkMedicalLaw(p.data.text, prohibited);
  });
}
