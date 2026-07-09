// 목표 경로: src/server/actions/quotes.ts
//
// 견적서 3종(BASIC/STANDARD/PREMIUM) — 상품 마스터 기반 자동 구성. 사람이 검토 후 상태 변경.
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

// 티어별 기본 상품 구성(상품명, 예시 월단가). 실제 금액은 발급 후 조정.
const TIERS: Record<string, { names: string[]; fee: Record<string, number> }> = {
  BASIC: { names: ["블로그 배포", "플레이스 SEO"], fee: { "블로그 배포": 300000, "플레이스 SEO": 200000 } },
  STANDARD: {
    names: ["브랜드 블로그", "블로그 배포", "플레이스 SEO", "SNS 배포", "파워링크"],
    fee: { "브랜드 블로그": 400000, "블로그 배포": 300000, "플레이스 SEO": 200000, "SNS 배포": 250000, "파워링크": 200000 }
  },
  PREMIUM: {
    names: ["브랜드 블로그", "블로그 상위노출", "플레이스 상위노출", "SNS 배포", "파워링크", "SEO"],
    fee: { "브랜드 블로그": 400000, "블로그 상위노출": 500000, "플레이스 상위노출": 500000, "SNS 배포": 250000, "파워링크": 200000, SEO: 300000 }
  }
};

export async function generateQuoteSet(input: unknown): Promise<ActionResult> {
  return runAction(async () => {
    const user = await requireUser();
    const p = z.object({ clientId: z.string().min(1) }).safeParse(input);
    if (!p.success) throw new Error("VALIDATION");
    const clientId = p.data.clientId;

    const client = await db.client.findUnique({ where: { id: clientId }, select: { assignedMarketerId: true } });
    if (!client) throw new Error("NOT_FOUND");
    const scopes = await getAdminScopes(user);
    assertCanAccessClient(user, clientId, scopes, client.assignedMarketerId);

    const products = await db.product.findMany({ where: { isActive: true }, select: { id: true, name: true } });
    const byName = new Map(products.map((pr) => [pr.name, pr.id]));

    const meta = await requestMeta();
    const orgId = await getDefaultOrgId();
    await db.$transaction(async (tx) => {
      // 기존 DRAFT 견적을 지우고 새로 3종 생성(재생성 시 중복 방지).
      await tx.quote.deleteMany({ where: { clientId, status: "DRAFT" } });
      for (const [tier, cfg] of Object.entries(TIERS)) {
        const items = cfg.names.map((name) => ({ productId: byName.get(name) ?? null, name, monthlyFee: cfg.fee[name] ?? 0, quantity: 1 }));
        const monthlyTotal = items.reduce((s, it) => s + it.monthlyFee * it.quantity, 0);
        await tx.quote.create({ data: { clientId, tier, items, monthlyTotal, status: "DRAFT", orgId } });
      }
      await recordAudit(tx, { actorId: user.id, action: "quote.generateSet", targetType: "Client", targetId: clientId, afterState: { tiers: Object.keys(TIERS) }, ...meta });
    });

    revalidatePath(`/clients/${clientId}`);
  });
}

export async function updateQuoteStatus(input: unknown): Promise<ActionResult> {
  return runAction(async () => {
    const user = await requireUser();
    const p = z.object({ id: z.string().min(1), status: z.enum(["DRAFT", "SENT", "ACCEPTED", "REJECTED"]) }).safeParse(input);
    if (!p.success) throw new Error("VALIDATION");

    const quote = await db.quote.findUnique({ where: { id: p.data.id }, select: { clientId: true, client: { select: { assignedMarketerId: true } } } });
    if (!quote) throw new Error("NOT_FOUND");
    const scopes = await getAdminScopes(user);
    assertCanAccessClient(user, quote.clientId, scopes, quote.client.assignedMarketerId);

    const meta = await requestMeta();
    await db.$transaction(async (tx) => {
      await tx.quote.update({ where: { id: p.data.id }, data: { status: p.data.status } });
      await recordAudit(tx, { actorId: user.id, action: "quote.status", targetType: "Quote", targetId: p.data.id, afterState: { status: p.data.status }, ...meta });
    });
    revalidatePath(`/clients/${quote.clientId}`);
  });
}
