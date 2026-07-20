// 목표 경로: src/server/actions/weekly-reports.ts
//
// 주간 업무보고 — 직원이 한 주 단위로 작성/수정/삭제.
// weekStart 는 입력 날짜가 속한 주의 "월요일 00:00"로 정규화해 저장(주별 1건 유니크).
// 권한: 작성/수정/삭제 = 본인 또는 관리자 이상.
"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { Role } from "@/domain/types";
import { db } from "@/server/db";
import {
  recordAudit,
  requestMeta,
  requireUser,
  runAction,
  type ActionResult
} from "@/server/actions/_helpers";
import { requestApproval } from "@/server/actions/approvals";

const weekFmt = new Intl.DateTimeFormat("ko-KR", { year: "numeric", month: "long", day: "numeric" });

/** 주어진 날짜가 속한 주의 월요일 00:00(UTC 기준 날짜)로 정규화. */
function toWeekStart(dateStr: string): Date {
  const d = new Date(`${dateStr}T00:00:00.000Z`);
  const day = d.getUTCDay(); // 0=일 … 1=월
  const diff = (day + 6) % 7; // 월요일까지 되돌릴 일수
  d.setUTCDate(d.getUTCDate() - diff);
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

const upsertShape = {
  weekStart: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  summary: z.string().trim().min(1).max(500),
  achievements: z.string().trim().max(4000).optional().nullable(),
  plans: z.string().trim().max(4000).optional().nullable(),
  issues: z.string().trim().max(4000).optional().nullable()
};

const createSchema = z.object(upsertShape);

export async function createWeeklyReport(input: unknown): Promise<ActionResult<{ id: string }>> {
  return runAction(async () => {
    const user = await requireUser();
    const p = createSchema.safeParse(input);
    if (!p.success) throw new Error("VALIDATION");
    const d = p.data;
    const weekStart = toWeekStart(d.weekStart);

    const dup = await db.weeklyReport.findUnique({ where: { authorId_weekStart: { authorId: user.id, weekStart } } });
    if (dup) throw new Error("DUPLICATE_WEEK");

    const meta = await requestMeta();
    const saved = await db.$transaction(async (tx) => {
      const wr = await tx.weeklyReport.create({
        data: {
          authorId: user.id,
          weekStart,
          summary: d.summary,
          achievements: d.achievements || null,
          plans: d.plans || null,
          issues: d.issues || null,
          status: "SUBMITTED"
        }
      });
      await recordAudit(tx, { actorId: user.id, action: "weeklyReport.create", targetType: "WeeklyReport", targetId: wr.id, afterState: { weekStart: weekStart.toISOString() }, ...meta });
      return wr;
    });
    // 결재라인 연결 — 상신하면 담당자→관리자→최고관리자 순으로 결재된다(승인함에 노출).
    await requestApproval({ targetType: "WEEKLY_REPORT", targetId: saved.id, title: `주간보고 · ${weekFmt.format(weekStart)} 주` }).catch(() => undefined);
    revalidatePath("/weekly");
    revalidatePath("/reports");
    return { id: saved.id };
  });
}

const updateSchema = z.object({ id: z.string().min(1), ...upsertShape });

export async function updateWeeklyReport(input: unknown): Promise<ActionResult> {
  return runAction(async () => {
    const user = await requireUser();
    const p = updateSchema.safeParse(input);
    if (!p.success) throw new Error("VALIDATION");
    const d = p.data;
    const existing = await db.weeklyReport.findUnique({ where: { id: d.id } });
    if (!existing) throw new Error("NOT_FOUND");
    const isManager = user.role === Role.SUPER_ADMIN || user.role === Role.ADMIN;
    if (!isManager && existing.authorId !== user.id) throw new Error("FORBIDDEN");

    const meta = await requestMeta();
    await db.$transaction(async (tx) => {
      await tx.weeklyReport.update({
        where: { id: d.id },
        data: {
          summary: d.summary,
          achievements: d.achievements || null,
          plans: d.plans || null,
          issues: d.issues || null
        }
      });
      await recordAudit(tx, { actorId: user.id, action: "weeklyReport.update", targetType: "WeeklyReport", targetId: d.id, afterState: { summary: d.summary }, ...meta });
    });
    revalidatePath("/weekly");
  });
}

export async function deleteWeeklyReport(input: unknown): Promise<ActionResult> {
  return runAction(async () => {
    const user = await requireUser();
    const p = z.object({ id: z.string().min(1) }).safeParse(input);
    if (!p.success) throw new Error("VALIDATION");
    const existing = await db.weeklyReport.findUnique({ where: { id: p.data.id } });
    if (!existing) throw new Error("NOT_FOUND");
    const isManager = user.role === Role.SUPER_ADMIN || user.role === Role.ADMIN;
    if (!isManager && existing.authorId !== user.id) throw new Error("FORBIDDEN");

    const meta = await requestMeta();
    await db.$transaction(async (tx) => {
      await tx.weeklyReport.delete({ where: { id: p.data.id } });
      await recordAudit(tx, { actorId: user.id, action: "weeklyReport.delete", targetType: "WeeklyReport", targetId: p.data.id, beforeState: { weekStart: existing.weekStart.toISOString() }, ...meta });
    });
    revalidatePath("/weekly");
  });
}
