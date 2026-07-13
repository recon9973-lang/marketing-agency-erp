// 플랫폼 공지 관리 액션 — 관리자(effective role ADMIN 이상) 전용.
// 자동 수집이 못 잡는 네이버 공지 등을 수동 등록/고정/삭제하고, 온디맨드 수집을 트리거한다.
"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { Role } from "@/domain/types";
import { isPlatformKind, isUpdateCategory } from "@/domain/platform-updates";
import { db } from "@/server/db";
import { getDefaultOrgId } from "@/server/org";
import { runPlatformUpdatesSync } from "@/server/jobs/platform-updates";
import { recordAudit, requestMeta, requireUser, runAction, type ActionResult } from "@/server/actions/_helpers";

function assertManager(role: Role) {
  if (role !== Role.SUPER_ADMIN && role !== Role.ADMIN) throw new Error("FORBIDDEN");
}

const addSchema = z.object({
  platform: z.string().refine(isPlatformKind, "platform"),
  category: z.string().refine(isUpdateCategory, "category"),
  title: z.string().trim().min(1).max(300),
  url: z.string().trim().url().max(1000).optional().or(z.literal("")),
  summary: z.string().trim().max(500).optional().or(z.literal("")),
  publishedAt: z.string().trim().optional()
});

/** 수동 공지 등록 — 즉시 배너 반영(실시간). */
export async function addPlatformUpdate(input: unknown): Promise<ActionResult<{ id: string }>> {
  return runAction(async () => {
    const user = await requireUser();
    assertManager(user.role);
    const p = addSchema.safeParse(input);
    if (!p.success) throw new Error("VALIDATION");
    const d = p.data;

    const publishedAt = d.publishedAt ? new Date(d.publishedAt) : new Date();
    if (Number.isNaN(publishedAt.getTime())) throw new Error("VALIDATION");

    const orgId = await getDefaultOrgId().catch(() => null);
    const meta = await requestMeta();
    const created = await db.$transaction(async (tx) => {
      const row = await tx.platformUpdate.create({
        data: {
          platform: d.platform,
          category: d.category,
          title: d.title,
          url: d.url ? d.url : null,
          summary: d.summary ? d.summary : null,
          source: "manual",
          externalKey: `manual:${randomUUID()}`,
          publishedAt,
          isManual: true,
          createdById: user.id,
          orgId
        }
      });
      await recordAudit(tx, { actorId: user.id, action: "platformUpdate.add", targetType: "PlatformUpdate", targetId: row.id, afterState: { title: d.title, platform: d.platform }, ...meta });
      return row;
    });

    revalidatePath("/dashboard");
    revalidatePath("/settings");
    return { id: created.id };
  });
}

/** 삭제 — 수집분·수동분 모두 가능. */
export async function deletePlatformUpdate(input: unknown): Promise<ActionResult> {
  return runAction(async () => {
    const user = await requireUser();
    assertManager(user.role);
    const p = z.object({ id: z.string().min(1) }).safeParse(input);
    if (!p.success) throw new Error("VALIDATION");

    const target = await db.platformUpdate.findUnique({ where: { id: p.data.id }, select: { id: true, title: true } });
    if (!target) throw new Error("NOT_FOUND");

    const meta = await requestMeta();
    await db.$transaction(async (tx) => {
      await tx.platformUpdate.delete({ where: { id: p.data.id } });
      await recordAudit(tx, { actorId: user.id, action: "platformUpdate.delete", targetType: "PlatformUpdate", targetId: p.data.id, beforeState: { title: target.title }, ...meta });
    });

    revalidatePath("/dashboard");
    revalidatePath("/settings");
  });
}

/** 고정 토글 — 고정된 공지는 배너에서 항상 우선 노출. */
export async function togglePinPlatformUpdate(input: unknown): Promise<ActionResult> {
  return runAction(async () => {
    const user = await requireUser();
    assertManager(user.role);
    const p = z.object({ id: z.string().min(1), pinned: z.boolean() }).safeParse(input);
    if (!p.success) throw new Error("VALIDATION");

    const target = await db.platformUpdate.findUnique({ where: { id: p.data.id }, select: { id: true, pinned: true } });
    if (!target) throw new Error("NOT_FOUND");

    const meta = await requestMeta();
    await db.$transaction(async (tx) => {
      await tx.platformUpdate.update({ where: { id: p.data.id }, data: { pinned: p.data.pinned } });
      await recordAudit(tx, { actorId: user.id, action: "platformUpdate.pin", targetType: "PlatformUpdate", targetId: p.data.id, beforeState: { pinned: target.pinned }, afterState: { pinned: p.data.pinned }, ...meta });
    });

    revalidatePath("/dashboard");
    revalidatePath("/settings");
  });
}

/** 온디맨드 자동 수집 — 관리자가 "지금 수집"으로 즉시 최신 피드를 당긴다. */
export async function refreshPlatformUpdatesNow(): Promise<ActionResult<{ inserted: number; fetched: number; failed: number }>> {
  return runAction(async () => {
    const user = await requireUser();
    assertManager(user.role);
    const result = await runPlatformUpdatesSync();
    revalidatePath("/dashboard");
    revalidatePath("/settings");
    return { inserted: result.inserted, fetched: result.fetched, failed: result.failed };
  });
}
