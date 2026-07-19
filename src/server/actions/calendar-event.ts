// 목표 경로: src/server/actions/calendar-event.ts
//
// 자체 캘린더 — 독립 일정(업무·연차 미연결) 생성·삭제. 담당자 직접배정(assigneeId).
// 캘린더 재설계 C4: 시스템 이벤트(workItem·leave 연결)는 건드리지 않고, 사람이 직접 만든
// INTERNAL 일정만 다룬다.
"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { canAccessMarketer } from "@/domain/access-control";
import { Role } from "@/domain/types";
import { db } from "@/server/db";
import { kstToUtc } from "@/server/actions/calendar-event-util";
import {
  getAdminScopes,
  recordAudit,
  requestMeta,
  requireUser,
  runAction,
  type ActionResult
} from "@/server/actions/_helpers";

const KINDS = ["TASK", "CLIENT_MEETING", "REPORT_DEADLINE", "INTERNAL_INSTRUCTION"] as const;

const schema = z
  .object({
    title: z.string().trim().min(1).max(120),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    startTime: z.string().regex(/^\d{2}:\d{2}$/),
    endTime: z.string().regex(/^\d{2}:\d{2}$/),
    kind: z.enum(KINDS),
    assigneeId: z.string().min(1).optional().nullable(),
    clientId: z.string().min(1).optional().nullable(),
    description: z.string().trim().max(500).optional().nullable()
  })
  .refine((d) => d.endTime >= d.startTime, { message: "END_BEFORE_START" });

export async function createCalendarEvent(input: unknown): Promise<ActionResult<{ id: string }>> {
  return runAction(async () => {
    const user = await requireUser();
    const p = schema.safeParse(input);
    if (!p.success) throw new Error("VALIDATION");
    const d = p.data;

    // 담당자 배정 권한: 본인은 항상 가능. 타인 배정은 관리자 스코프 내에서만.
    const assigneeId = d.assigneeId || null;
    if (assigneeId && assigneeId !== user.id) {
      if (user.role === Role.MARKETER) throw new Error("FORBIDDEN");
      const scopes = await getAdminScopes(user);
      if (!canAccessMarketer(user, assigneeId, scopes)) throw new Error("FORBIDDEN");
      const target = await db.user.findUnique({ where: { id: assigneeId }, select: { id: true } });
      if (!target) throw new Error("NOT_FOUND");
    }

    const startsAt = kstToUtc(d.date, d.startTime);
    const endsAt = kstToUtc(d.date, d.endTime);
    const meta = await requestMeta();

    const saved = await db.$transaction(async (tx) => {
      const event = await tx.calendarEvent.create({
        data: {
          title: d.title,
          description: d.description || null,
          startsAt,
          endsAt,
          provider: "INTERNAL",
          kind: d.kind,
          createdById: user.id,
          assigneeId: assigneeId ?? user.id, // 미지정 시 생성자 본인 일정
          clientId: d.clientId || null
        }
      });
      await recordAudit(tx, {
        actorId: user.id,
        action: "calendar.event.create",
        targetType: "CalendarEvent",
        targetId: event.id,
        afterState: { title: d.title, kind: d.kind, assigneeId: event.assigneeId },
        ...meta
      });
      return event;
    });

    revalidatePath("/calendar");
    return { id: saved.id };
  });
}

export async function deleteCalendarEvent(input: unknown): Promise<ActionResult> {
  return runAction(async () => {
    const user = await requireUser();
    const p = z.object({ id: z.string().min(1) }).safeParse(input);
    if (!p.success) throw new Error("VALIDATION");

    const event = await db.calendarEvent.findUnique({
      where: { id: p.data.id },
      select: { id: true, provider: true, createdById: true, assigneeId: true, workItemId: true, leaveRequestId: true, reportId: true }
    });
    if (!event) throw new Error("NOT_FOUND");
    // 시스템 이벤트(업무·연차·리포트 연결)는 삭제 불가 — 원천에서만 관리.
    if (event.provider !== "INTERNAL" || event.workItemId || event.leaveRequestId || event.reportId) {
      throw new Error("SYSTEM_EVENT");
    }
    // 생성자·담당자 본인 또는 관리자만 삭제.
    const isOwnerish = event.createdById === user.id || event.assigneeId === user.id;
    const isManager = user.role === Role.SUPER_ADMIN || user.role === Role.ADMIN;
    if (!isOwnerish && !isManager) throw new Error("FORBIDDEN");

    const meta = await requestMeta();
    await db.$transaction(async (tx) => {
      await tx.calendarEvent.delete({ where: { id: event.id } });
      await recordAudit(tx, {
        actorId: user.id,
        action: "calendar.event.delete",
        targetType: "CalendarEvent",
        targetId: event.id,
        ...meta
      });
    });

    revalidatePath("/calendar");
  });
}
