"use server";

// 업무 보고(작업 결과물) — 담당자가 당일 결과물 링크를 거래처별로 남기고, 관리자는 팀 전체를 본다.
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { db } from "@/server/db";
import { Role } from "@/domain/types";
import { assertCanAccessClient } from "@/domain/access-control";
import { getAdminScopes, requireUser, runAction, type ActionResult } from "@/server/actions/_helpers";

async function ensureTable(): Promise<void> {
  try {
    await db.$executeRawUnsafe(
      `CREATE TABLE IF NOT EXISTS "WorkReport" ("id" TEXT NOT NULL, "clientId" TEXT NOT NULL, "authorId" TEXT NOT NULL, "workDate" TIMESTAMP(3) NOT NULL, "category" TEXT NOT NULL, "title" TEXT NOT NULL, "link" TEXT, "note" TEXT, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "WorkReport_pkey" PRIMARY KEY ("id"))`
    );
    await db.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "WorkReport_clientId_idx" ON "WorkReport" ("clientId")`);
    await db.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "WorkReport_authorId_idx" ON "WorkReport" ("authorId")`);
    await db.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "WorkReport_workDate_idx" ON "WorkReport" ("workDate")`);
    await db.$executeRawUnsafe(`ALTER TABLE "WorkReport" ADD COLUMN IF NOT EXISTS "workItemId" TEXT`);
  } catch (e) {
    console.warn("[work-report] 테이블 보장 실패(무시):", String(e).slice(0, 140));
  }
}

function normalizeLink(raw?: string | null): string | null {
  let link = raw?.trim() || null;
  if (link && !/^https?:\/\//i.test(link)) link = `https://${link}`;
  return link;
}

const bulkSchema = z.object({
  clientId: z.string().min(1),
  workDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "날짜 형식이 올바르지 않습니다."),
  category: z.string().trim().min(1).max(60),
  workItemId: z.string().trim().optional().nullable(),
  items: z
    .array(
      z.object({
        title: z.string().trim().min(1).max(300),
        link: z.string().trim().max(1000).optional().nullable(),
        note: z.string().trim().max(2000).optional().nullable()
      })
    )
    .min(1)
    .max(20)
});

/** 여러 건의 결과물을 한 번에 등록(같은 거래처·일자·종류·연결업무 공유). */
export async function createWorkReports(input: unknown): Promise<ActionResult<{ count: number }>> {
  return runAction(async () => {
    const user = await requireUser();
    const p = bulkSchema.safeParse(input);
    if (!p.success) throw new Error("VALIDATION");
    const d = p.data;

    // 접근 가능한 거래처만 보고 가능.
    const client = await db.client.findUnique({ where: { id: d.clientId }, select: { assignedMarketerId: true } });
    if (!client) throw new Error("NOT_FOUND");
    const scopes = await getAdminScopes(user);
    assertCanAccessClient(user, d.clientId, scopes, client.assignedMarketerId);

    // 연결 업무가 지정되면 같은 거래처의 업무인지 확인.
    let workItemId: string | null = d.workItemId?.trim() || null;
    if (workItemId) {
      const wi = await db.workItem.findUnique({ where: { id: workItemId }, select: { clientId: true } });
      if (!wi || wi.clientId !== d.clientId) workItemId = null;
    }

    await ensureTable();
    const workDate = new Date(`${d.workDate}T00:00:00`);
    await db.workReport.createMany({
      data: d.items.map((it) => ({
        clientId: d.clientId,
        authorId: user.id,
        workItemId,
        workDate,
        category: d.category.trim(),
        title: it.title.trim(),
        link: normalizeLink(it.link),
        note: it.note?.trim() || null
      }))
    });
    revalidatePath("/worklog");
    return { count: d.items.length };
  });
}

export async function deleteWorkReport(input: unknown): Promise<ActionResult> {
  return runAction(async () => {
    const user = await requireUser();
    const p = z.object({ id: z.string().min(1) }).safeParse(input);
    if (!p.success) throw new Error("VALIDATION");
    const existing = await db.workReport.findUnique({ where: { id: p.data.id }, select: { authorId: true } });
    if (!existing) throw new Error("NOT_FOUND");
    // 작성자 본인 또는 관리자만 삭제.
    const isManager = user.role === Role.SUPER_ADMIN || user.role === Role.ADMIN;
    if (!isManager && existing.authorId !== user.id) throw new Error("FORBIDDEN");
    await db.workReport.delete({ where: { id: p.data.id } });
    revalidatePath("/worklog");
  });
}
