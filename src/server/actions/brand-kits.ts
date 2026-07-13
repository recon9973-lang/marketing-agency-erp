// 브랜드킷 — 생성/수정/삭제. 관리자(ADMIN 이상) 전용, 조직 스코프.
"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { Role } from "@/domain/types";
import { db } from "@/server/db";
import { getDefaultOrgId } from "@/server/org";
import { requireUser, runAction, type ActionResult } from "@/server/actions/_helpers";
import type { CurrentUser } from "@/server/session";

const HEX = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;

const kitSchema = z.object({
  name: z.string().trim().min(1).max(60),
  clientId: z.string().trim().optional().nullable().transform((v) => v || null),
  colors: z.array(z.string().regex(HEX, "색상은 #RRGGBB 형식")).max(12).default([]),
  fontFamily: z.string().trim().max(80).optional().nullable().transform((v) => v || null)
});

function assertManager(user: CurrentUser) {
  if (user.role !== Role.SUPER_ADMIN && user.role !== Role.ADMIN) throw new Error("FORBIDDEN");
}

export async function createBrandKit(input: unknown): Promise<ActionResult<{ id: string }>> {
  return runAction(async () => {
    const user = await requireUser();
    assertManager(user);
    const orgId = await getDefaultOrgId();
    const d = kitSchema.parse(input);
    const created = await db.brandKit.create({
      data: { orgId, name: d.name, clientId: d.clientId, colors: d.colors, fontFamily: d.fontFamily }
    });
    revalidatePath("/studio/brand");
    return { id: created.id };
  });
}

const updateSchema = kitSchema.extend({ id: z.string().min(1) });

export async function updateBrandKit(input: unknown): Promise<ActionResult> {
  return runAction(async () => {
    const user = await requireUser();
    assertManager(user);
    const orgId = await getDefaultOrgId();
    const d = updateSchema.parse(input);
    const existing = await db.brandKit.findUnique({ where: { id: d.id } });
    if (!existing || existing.orgId !== orgId) throw new Error("NOT_FOUND");
    await db.brandKit.update({
      where: { id: d.id },
      data: { name: d.name, clientId: d.clientId, colors: d.colors, fontFamily: d.fontFamily }
    });
    revalidatePath("/studio/brand");
  });
}

export async function deleteBrandKit(input: unknown): Promise<ActionResult> {
  return runAction(async () => {
    const user = await requireUser();
    assertManager(user);
    const orgId = await getDefaultOrgId();
    const { id } = z.object({ id: z.string().min(1) }).parse(input);
    const existing = await db.brandKit.findUnique({ where: { id } });
    if (!existing || existing.orgId !== orgId) throw new Error("NOT_FOUND");
    await db.brandKit.delete({ where: { id } });
    revalidatePath("/studio/brand");
  });
}
