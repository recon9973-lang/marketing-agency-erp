// 목표 경로: src/server/actions/scopes.ts
//
// 관리자 접근 범위(AccessScope) 편집 — 최고관리자 전용.
// 한 관리자에게 "담당자 전체/특정" 또는 "거래처 전체/특정" 권한을 부여·삭제한다.
"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { db } from "@/server/db";
import { Role } from "@/domain/types";
import {
  recordAudit,
  requestMeta,
  requireUser,
  runAction,
  type ActionResult
} from "@/server/actions/_helpers";

const grantSchema = z.object({
  adminId: z.string().min(1),
  kind: z.enum(["ALL_MARKETERS", "MARKETER", "ALL_CLIENTS", "CLIENT"]),
  targetId: z.string().min(1).optional()
});

export async function addAccessScope(input: unknown): Promise<ActionResult<{ id: string }>> {
  return runAction(async () => {
    const user = await requireUser();
    if (user.role !== Role.SUPER_ADMIN) throw new Error("FORBIDDEN");
    const p = grantSchema.safeParse(input);
    if (!p.success) throw new Error("VALIDATION");
    const { adminId, kind, targetId } = p.data;

    // 대상은 반드시 관리자(ADMIN) — 최고관리자는 이미 전체 접근이라 스코프가 불필요.
    const admin = await db.user.findUnique({ where: { id: adminId }, select: { role: true } });
    if (!admin || admin.role !== Role.ADMIN) throw new Error("NOT_ADMIN");

    const data: { adminId: string; allMarketers?: boolean; marketerId?: string; allClients?: boolean; clientId?: string } = { adminId };
    if (kind === "ALL_MARKETERS") {
      data.allMarketers = true;
    } else if (kind === "MARKETER") {
      if (!targetId) throw new Error("VALIDATION");
      const m = await db.user.findUnique({ where: { id: targetId }, select: { role: true } });
      if (!m || m.role !== Role.MARKETER) throw new Error("NOT_MARKETER");
      data.marketerId = targetId;
    } else if (kind === "ALL_CLIENTS") {
      data.allClients = true;
    } else {
      if (!targetId) throw new Error("VALIDATION");
      const c = await db.client.findUnique({ where: { id: targetId }, select: { id: true } });
      if (!c) throw new Error("NOT_FOUND");
      data.clientId = targetId;
    }

    const meta = await requestMeta();
    const created = await db.$transaction(async (tx) => {
      const scope = await tx.accessScope.create({ data, select: { id: true } });
      await recordAudit(tx, { actorId: user.id, action: "scope.add", targetType: "AccessScope", targetId: scope.id, afterState: { adminId, kind, targetId: targetId ?? null }, ...meta });
      return scope;
    });
    revalidatePath("/settings");
    return { id: created.id };
  });
}

export async function removeAccessScope(input: unknown): Promise<ActionResult> {
  return runAction(async () => {
    const user = await requireUser();
    if (user.role !== Role.SUPER_ADMIN) throw new Error("FORBIDDEN");
    const p = z.object({ id: z.string().min(1) }).safeParse(input);
    if (!p.success) throw new Error("VALIDATION");

    const meta = await requestMeta();
    await db.$transaction(async (tx) => {
      await tx.accessScope.delete({ where: { id: p.data.id } });
      await recordAudit(tx, { actorId: user.id, action: "scope.remove", targetType: "AccessScope", targetId: p.data.id, ...meta });
    });
    revalidatePath("/settings");
  });
}
