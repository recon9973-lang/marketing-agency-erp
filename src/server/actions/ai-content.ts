// 목표 경로: src/server/actions/ai-content.ts
//
// AI 마케팅 엔진 — Claude로 블로그/카드뉴스/SNS/광고/키워드 콘텐츠를 생성하고 보관.
// 권한: 로그인 사용자 누구나 생성. 거래처 연계 시 접근 권한 검증.
// 키 미설정(ANTHROPIC_API_KEY) 시 AI_NOT_CONFIGURED 로 안내(“키 넣으면 켜짐”).
"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { Role } from "@/domain/types";
import { assertCanAccessClient } from "@/domain/access-control";
import { db } from "@/server/db";
import {
  getAdminScopes,
  recordAudit,
  requestMeta,
  requireUser,
  runAction,
  type ActionResult
} from "@/server/actions/_helpers";
import { AI_MODEL, generateMarketingContent, type AiContentKind } from "@/server/ai/claude";
import { checkMedicalLaw, type ComplianceResult } from "@/server/compliance/medical-law";
import type { CurrentUser } from "@/server/session";

const KINDS = ["BLOG", "CARD_NEWS", "SNS", "AD_COPY", "KEYWORD"] as const;

const generateSchema = z.object({
  kind: z.enum(KINDS),
  topic: z.string().trim().min(1).max(500),
  keywords: z.string().trim().max(500).optional().nullable(),
  tone: z.string().trim().max(200).optional().nullable(),
  clientId: z.string().trim().optional().nullable(),
  medicalCheck: z.boolean().optional() // 의료법 검수 적용 여부(콘텐츠 생성단 체크박스)
});

export async function generateAiContent(
  input: unknown
): Promise<ActionResult<{ id: string; compliance: ComplianceResult | null }>> {
  return runAction(async () => {
    const user = await requireUser();
    const p = generateSchema.safeParse(input);
    if (!p.success) throw new Error("VALIDATION");
    const d = p.data;

    // 거래처 연계 시 접근 권한 확인 + 프롬프트 컨텍스트 확보.
    let clientName: string | null = null;
    let industry: string | null = null;
    const clientId = d.clientId && d.clientId.length > 0 ? d.clientId : null;
    if (clientId) {
      const client = await db.client.findUnique({
        where: { id: clientId },
        select: {
          name: true,
          assignedMarketerId: true,
          industryCategory: { select: { name: true, parent: { select: { name: true } } } },
          industryCustom: true
        }
      });
      if (!client) throw new Error("NOT_FOUND");
      await assertClient(user, clientId, client.assignedMarketerId);
      clientName = client.name;
      industry =
        client.industryCategory?.name ??
        client.industryCategory?.parent?.name ??
        client.industryCustom ??
        null;
    }

    // 실제 AI 생성. 키 없으면 여기서 AI_NOT_CONFIGURED throw.
    const result = await generateMarketingContent({
      kind: d.kind as AiContentKind,
      topic: d.topic,
      keywords: d.keywords ?? null,
      tone: d.tone ?? null,
      clientName,
      industry
    });

    const meta = await requestMeta();
    const saved = await db.$transaction(async (tx) => {
      const row = await tx.aiContent.create({
        data: {
          authorId: user.id,
          clientId,
          kind: d.kind,
          topic: d.topic,
          keywords: d.keywords || null,
          tone: d.tone || null,
          result,
          model: AI_MODEL,
          status: "DONE"
        }
      });
      await recordAudit(tx, {
        actorId: user.id,
        action: "aiContent.generate",
        targetType: "AiContent",
        targetId: row.id,
        afterState: { kind: row.kind, topic: row.topic },
        ...meta
      });
      return row;
    });

    revalidatePath("/ai-studio");
    // 의료법 검수 적용 시 규칙엔진으로 위험 표현을 즉시 진단(결과는 화면에 표시).
    const compliance = d.medicalCheck ? checkMedicalLaw(result) : null;
    return { id: saved.id, compliance };
  });
}

export async function deleteAiContent(input: unknown): Promise<ActionResult> {
  return runAction(async () => {
    const user = await requireUser();
    const p = z.object({ id: z.string().min(1) }).safeParse(input);
    if (!p.success) throw new Error("VALIDATION");
    const existing = await db.aiContent.findUnique({ where: { id: p.data.id } });
    if (!existing) throw new Error("NOT_FOUND");
    const isManager = user.role === Role.SUPER_ADMIN || user.role === Role.ADMIN;
    if (!isManager && existing.authorId !== user.id) throw new Error("FORBIDDEN");

    const meta = await requestMeta();
    await db.$transaction(async (tx) => {
      await tx.aiContent.delete({ where: { id: p.data.id } });
      await recordAudit(tx, {
        actorId: user.id,
        action: "aiContent.delete",
        targetType: "AiContent",
        targetId: p.data.id,
        beforeState: { kind: existing.kind, topic: existing.topic },
        ...meta
      });
    });
    revalidatePath("/ai-studio");
  });
}

async function assertClient(user: CurrentUser, clientId: string, assignedMarketerId: string | null) {
  const scopes = await getAdminScopes(user);
  assertCanAccessClient(user, clientId, scopes, assignedMarketerId);
}
