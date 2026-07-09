// 목표 경로: src/server/actions/contract-products.ts
//
// 계약↔상품 브릿지(ContractProduct) 추가/삭제. SIGNED 계약은 수정 불가(잠금).
// 권한: 계약의 거래처 접근 가능자.
"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

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
import type { CurrentUser } from "@/server/session";

// 계약 → 거래처 접근 권한 확인 + 잠금 여부 반환.
async function loadContractForEdit(user: CurrentUser, contractId: string) {
  const contract = await db.contract.findUnique({
    where: { id: contractId },
    select: { id: true, clientId: true, status: true, client: { select: { assignedMarketerId: true } } }
  });
  if (!contract) throw new Error("NOT_FOUND");
  const scopes = await getAdminScopes(user);
  assertCanAccessClient(user, contract.clientId, scopes, contract.client.assignedMarketerId);
  if (contract.status === "SIGNED") throw new Error("CONTRACT_LOCKED");
  return contract;
}

const addSchema = z.object({
  contractId: z.string().min(1),
  productId: z.string().min(1),
  monthlyFee: z.coerce.number().nonnegative().optional().nullable(),
  adBudget: z.coerce.number().nonnegative().optional().nullable(),
  quantity: z.coerce.number().int().positive().max(999).optional(),
  notes: z.string().trim().max(500).optional().nullable()
});

export async function addContractProduct(input: unknown): Promise<ActionResult<{ id: string }>> {
  return runAction(async () => {
    const user = await requireUser();
    const p = addSchema.safeParse(input);
    if (!p.success) throw new Error("VALIDATION");
    const d = p.data;

    const contract = await loadContractForEdit(user, d.contractId);
    const product = await db.product.findUnique({ where: { id: d.productId }, select: { id: true } });
    if (!product) throw new Error("NOT_FOUND");

    const meta = await requestMeta();
    const created = await db.$transaction(async (tx) => {
      const row = await tx.contractProduct.create({
        data: {
          contractId: d.contractId,
          productId: d.productId,
          monthlyFee: d.monthlyFee ?? null,
          adBudget: d.adBudget ?? null,
          quantity: d.quantity ?? 1,
          notes: d.notes || null
        }
      });
      await recordAudit(tx, {
        actorId: user.id,
        action: "contractProduct.add",
        targetType: "ContractProduct",
        targetId: row.id,
        afterState: { contractId: d.contractId, productId: d.productId, monthlyFee: row.monthlyFee, quantity: row.quantity },
        ...meta
      });
      return row;
    });

    revalidatePath(`/contracts/${contract.id}`);
    return { id: created.id };
  });
}

const removeSchema = z.object({ id: z.string().min(1) });

export async function removeContractProduct(input: unknown): Promise<ActionResult> {
  return runAction(async () => {
    const user = await requireUser();
    const p = removeSchema.safeParse(input);
    if (!p.success) throw new Error("VALIDATION");

    const row = await db.contractProduct.findUnique({
      where: { id: p.data.id },
      select: { id: true, contractId: true }
    });
    if (!row) throw new Error("NOT_FOUND");

    const contract = await loadContractForEdit(user, row.contractId);

    const meta = await requestMeta();
    await db.$transaction(async (tx) => {
      await tx.contractProduct.delete({ where: { id: row.id } });
      await recordAudit(tx, {
        actorId: user.id,
        action: "contractProduct.remove",
        targetType: "ContractProduct",
        targetId: row.id,
        beforeState: { contractId: row.contractId },
        ...meta
      });
    });

    revalidatePath(`/contracts/${contract.id}`);
  });
}
