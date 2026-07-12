// 목표 경로: src/server/actions/channel-connections.ts
//
// 거래처 채널 API 연결 관리 — 대상 리소스(GSC 사이트·GA4 속성) 설정, 즉시 동기화, 연결 해제(권한 회수 §9·§14).
// OAuth 연결 자체는 /api/integrations/google/start → callback 라우트가 수행한다.
"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { assertCanAccessClient } from "@/domain/access-control";
import { db } from "@/server/db";
import { getDefaultOrgId } from "@/server/org";
import { runChannelSync } from "@/server/jobs/channel-sync";
import {
  getAdminScopes,
  recordAudit,
  requestMeta,
  requireUser,
  runAction,
  type ActionResult
} from "@/server/actions/_helpers";
import type { CurrentUser } from "@/server/session";

async function assertClient(user: CurrentUser, clientId: string) {
  const client = await db.client.findUnique({ where: { id: clientId }, select: { assignedMarketerId: true } });
  if (!client) throw new Error("NOT_FOUND");
  const scopes = await getAdminScopes(user);
  assertCanAccessClient(user, clientId, scopes, client.assignedMarketerId);
}

const settingsSchema = z.object({
  clientId: z.string().min(1),
  gscSiteUrl: z.string().trim().max(300).optional().nullable().transform((v) => v || null),
  ga4PropertyId: z
    .string()
    .trim()
    .max(30)
    .regex(/^[0-9]*$/, "GA4 속성 ID는 숫자입니다.")
    .optional()
    .nullable()
    .transform((v) => v || null)
});

/** 대상 리소스 저장 — OAuth 전에도 미리 입력 가능(연결 후 첫 동기화에 사용). */
export async function saveGoogleConnectionSettings(input: unknown): Promise<ActionResult> {
  return runAction(async () => {
    const user = await requireUser();
    const p = settingsSchema.safeParse(input);
    if (!p.success) throw new Error("VALIDATION");
    const d = p.data;
    await assertClient(user, d.clientId);

    const meta = await requestMeta();
    const orgId = await getDefaultOrgId();
    await db.$transaction(async (tx) => {
      await tx.channelConnection.upsert({
        where: { clientId_provider: { clientId: d.clientId, provider: "GOOGLE" } },
        create: { clientId: d.clientId, provider: "GOOGLE", gscSiteUrl: d.gscSiteUrl, ga4PropertyId: d.ga4PropertyId, orgId },
        update: { gscSiteUrl: d.gscSiteUrl, ga4PropertyId: d.ga4PropertyId }
      });
      await recordAudit(tx, {
        actorId: user.id,
        action: "channelConnection.settings",
        targetType: "ChannelConnection",
        targetId: d.clientId,
        afterState: { gscSiteUrl: d.gscSiteUrl, ga4PropertyId: d.ga4PropertyId },
        ...meta
      });
    });
    revalidatePath(`/clients/${d.clientId}`);
  });
}

/** 연결 해제(권한 회수) — 토큰 삭제 + DISCONNECTED. 계약종료 권한 회수 업무의 시스템 측 실행. */
export async function disconnectGoogleConnection(input: unknown): Promise<ActionResult> {
  return runAction(async () => {
    const user = await requireUser();
    const p = z.object({ clientId: z.string().min(1) }).safeParse(input);
    if (!p.success) throw new Error("VALIDATION");
    await assertClient(user, p.data.clientId);

    const meta = await requestMeta();
    await db.$transaction(async (tx) => {
      await tx.channelConnection.updateMany({
        where: { clientId: p.data.clientId, provider: "GOOGLE" },
        data: { refreshTokenEnc: null, status: "DISCONNECTED", lastError: null }
      });
      await recordAudit(tx, {
        actorId: user.id,
        action: "channelConnection.disconnect",
        targetType: "ChannelConnection",
        targetId: p.data.clientId,
        afterState: { provider: "GOOGLE" },
        ...meta
      });
    });
    revalidatePath(`/clients/${p.data.clientId}`);
  });
}

/** 즉시 동기화 — 연결 직후 데이터 확인용(전 연결 대상 실행, 멱등 upsert). */
export async function syncChannelMetricsNow(): Promise<ActionResult<{ synced: number; failed: number; rows: number }>> {
  return runAction(async () => {
    await requireUser();
    const r = await runChannelSync();
    revalidatePath("/insights");
    return { synced: r.synced, failed: r.failed, rows: r.rows };
  });
}