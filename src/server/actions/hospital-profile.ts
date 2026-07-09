// 목표 경로: src/server/actions/hospital-profile.ts
//
// 병원 프로파일(Source of Truth) 저장. 변경 시 sotVersion 증가 + 감사 로그.
// 인증 → 거래처 접근 권한 → 검증 → 트랜잭션(upsert + AuditLog) → revalidate.
"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { assertCanAccessClient } from "@/domain/access-control";
import { db } from "@/server/db";
import { getDefaultOrgId } from "@/server/org";
import {
  getAdminScopes,
  recordAudit,
  requestMeta,
  requireUser,
  runAction,
  type ActionResult
} from "@/server/actions/_helpers";

const upsertSchema = z.object({
  clientId: z.string().min(1),
  departments: z.string().trim().optional().nullable(),
  doctors: z.string().trim().optional().nullable(),
  strengths: z.string().trim().optional().nullable(),
  cautionTerms: z.string().trim().optional().nullable(),
  preferredTone: z.string().trim().optional().nullable(),
  prohibitedClaims: z.string().trim().optional().nullable(),
  competitorHospitals: z.string().trim().optional().nullable(),
  medicalLawNotes: z.string().trim().optional().nullable()
});

const clean = (v: string | null | undefined) => (v && v.trim() ? v.trim() : null);

export async function upsertHospitalProfile(input: unknown): Promise<ActionResult> {
  return runAction(async () => {
    const user = await requireUser();
    const parsed = upsertSchema.safeParse(input);
    if (!parsed.success) throw new Error("VALIDATION");
    const data = parsed.data;

    const client = await db.client.findUnique({
      where: { id: data.clientId },
      select: { assignedMarketerId: true }
    });
    if (!client) throw new Error("NOT_FOUND");

    const scopes = await getAdminScopes(user);
    assertCanAccessClient(user, data.clientId, scopes, client.assignedMarketerId);

    const meta = await requestMeta();
    const orgId = await getDefaultOrgId();

    const fields = {
      departments: clean(data.departments),
      doctors: clean(data.doctors),
      strengths: clean(data.strengths),
      cautionTerms: clean(data.cautionTerms),
      preferredTone: clean(data.preferredTone),
      prohibitedClaims: clean(data.prohibitedClaims),
      competitorHospitals: clean(data.competitorHospitals),
      medicalLawNotes: clean(data.medicalLawNotes)
    };

    await db.$transaction(async (tx) => {
      const before = await tx.hospitalProfile.findUnique({ where: { clientId: data.clientId } });
      const after = await tx.hospitalProfile.upsert({
        where: { clientId: data.clientId },
        // 신규: 버전 1. 기존: 변경마다 sotVersion +1(기준데이터 변경 이력).
        create: { clientId: data.clientId, orgId, ...fields },
        update: { ...fields, sotVersion: { increment: 1 } }
      });
      await recordAudit(tx, {
        actorId: user.id,
        action: before ? "hospitalProfile.update" : "hospitalProfile.create",
        targetType: "HospitalProfile",
        targetId: after.id,
        beforeState: before ?? undefined,
        afterState: after,
        ...meta
      });
    });

    revalidatePath(`/clients/${data.clientId}`);
  });
}
