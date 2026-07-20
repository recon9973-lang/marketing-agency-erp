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
  } catch (e) {
    console.warn("[work-report] 테이블 보장 실패(무시):", String(e).slice(0, 140));
  }
}

const createSchema = z.object({
  clientId: z.string().min(1),
  workDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "날짜 형식이 올바르지 않습니다."),
  category: z.string().trim().min(1).max(60),
  title: z.string().trim().min(1).max(300),
  link: z.string().trim().max(1000).optional().nullable(),
  note: z.string().trim().max(2000).optional().nullable()
});

export async function createWorkReport(input: unknown): Promise<ActionResult<{ id: string }>> {
  return runAction(async () => {
    const user = await requireUser();
    const p = createSchema.safeParse(input);
    if (!p.success) throw new Error("VALIDATION");
    const d = p.data;

    // 접근 가능한 거래처만 보고 가능.
    const client = await db.client.findUnique({ where: { id: d.clientId }, select: { assignedMarketerId: true } });
    if (!client) throw new Error("NOT_FOUND");
    const scopes = await getAdminScopes(user);
    assertCanAccessClient(user, d.clientId, scopes, client.assignedMarketerId);

    // 링크는 있으면 http(s) 형태로 정규화(스킴 없으면 https 부여).
    let link = d.link?.trim() || null;
    if (link && !/^https?:\/\//i.test(link)) link = `https://${link}`;

    await ensureTable();
    const row = await db.workReport.create({
      data: {
        clientId: d.clientId,
        authorId: user.id,
        workDate: new Date(`${d.workDate}T00:00:00`),
        category: d.category.trim(),
        title: d.title.trim(),
        link,
        note: d.note?.trim() || null
      },
      select: { id: true }
    });
    revalidatePath("/worklog");
    return { id: row.id };
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
