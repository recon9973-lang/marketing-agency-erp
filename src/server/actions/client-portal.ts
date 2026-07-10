// 목표 경로: src/server/actions/client-portal.ts
//
// 거래처 포털 — 내부: 접근 토큰 발급. 공개(로그인 불필요): 피드백 제출, 콘텐츠 컨펌.
// 보안: 공개 액션은 portalToken으로만 거래처를 특정하고, 화이트리스트 필드만 다룬다.
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

/** 내부 — 거래처 포털 토큰 발급(없으면 생성). 거래처 접근 권한 필요. */
export async function issuePortalToken(input: unknown): Promise<ActionResult<{ token: string }>> {
  return runAction(async () => {
    const user = await requireUser();
    const p = z.object({ clientId: z.string().min(1), reset: z.boolean().optional() }).safeParse(input);
    if (!p.success) throw new Error("VALIDATION");

    const client = await db.client.findUnique({ where: { id: p.data.clientId }, select: { assignedMarketerId: true, portalToken: true } });
    if (!client) throw new Error("NOT_FOUND");
    const scopes = await getAdminScopes(user);
    assertCanAccessClient(user, p.data.clientId, scopes, client.assignedMarketerId);

    let token = client.portalToken;
    if (!token || p.data.reset) {
      token = crypto.randomUUID();
      await db.client.update({ where: { id: p.data.clientId }, data: { portalToken: token } });
    }
    revalidatePath(`/clients/${p.data.clientId}`);
    return { token };
  });
}

// 공개 — portalToken으로 거래처를 찾아 담당자 알림에 사용.
async function clientFromToken(token: string) {
  const client = await db.client.findUnique({ where: { portalToken: token }, select: { id: true, name: true, orgId: true, assignedMarketerId: true } });
  if (!client) throw new Error("NOT_FOUND");
  return client;
}

/** 공개 — 거래처 일반 피드백 제출. */
export async function submitClientFeedback(input: unknown): Promise<ActionResult> {
  return runAction(async () => {
    const p = z.object({ token: z.string().min(1), message: z.string().trim().min(1).max(2000) }).safeParse(input);
    if (!p.success) throw new Error("VALIDATION");
    const client = await clientFromToken(p.data.token);

    await db.$transaction(async (tx) => {
      await tx.clientFeedback.create({ data: { clientId: client.id, message: p.data.message, kind: "GENERAL", orgId: client.orgId } });
      if (client.assignedMarketerId) {
        await tx.notification.create({
          data: { userId: client.assignedMarketerId, type: "CLIENT_FEEDBACK", title: `${client.name} 피드백 도착`, body: p.data.message.slice(0, 80), link: `/clients/${client.id}`, targetType: "Client", targetId: client.id, orgId: client.orgId }
        });
      }
    });
  });
}

/** 공개 — 거래처가 콘텐츠(REVIEWED)를 컨펌. clientConfirmedAt 기록 + 담당자 알림. */
export async function confirmContentByClient(input: unknown): Promise<ActionResult> {
  return runAction(async () => {
    const p = z.object({ token: z.string().min(1), planId: z.string().min(1), comment: z.string().trim().max(1000).optional().nullable() }).safeParse(input);
    if (!p.success) throw new Error("VALIDATION");
    const client = await clientFromToken(p.data.token);

    // 반드시 이 거래처의 REVIEWED 콘텐츠만.
    const plan = await db.contentPlan.findFirst({ where: { id: p.data.planId, clientId: client.id, status: "REVIEWED" }, select: { id: true, topic: true } });
    if (!plan) throw new Error("NOT_FOUND");

    await db.$transaction(async (tx) => {
      await tx.contentPlan.update({ where: { id: plan.id }, data: { clientConfirmedAt: new Date(), clientComment: p.data.comment || null } });
      await tx.clientFeedback.create({ data: { clientId: client.id, message: `[콘텐츠 컨펌] ${plan.topic}${p.data.comment ? ` — ${p.data.comment}` : ""}`, kind: "CONTENT_CONFIRM", orgId: client.orgId } });
      if (client.assignedMarketerId) {
        await tx.notification.create({
          data: { userId: client.assignedMarketerId, type: "CONTENT_CONFIRMED", title: `${client.name} 콘텐츠 컨펌`, body: plan.topic, link: `/clients/${client.id}`, targetType: "ContentPlan", targetId: plan.id, orgId: client.orgId }
        });
      }
    });
  });
}
