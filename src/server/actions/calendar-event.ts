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
import { parseIcs } from "@/server/calendar/ics";
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

// 담당자 배정 권한: 본인은 항상 가능. 타인 배정은 관리자 스코프 내에서만.
async function assertCanAssign(user: Awaited<ReturnType<typeof requireUser>>, assigneeId: string | null) {
  if (!assigneeId || assigneeId === user.id) return;
  if (user.role === Role.MARKETER) throw new Error("FORBIDDEN");
  const scopes = await getAdminScopes(user);
  if (!canAccessMarketer(user, assigneeId, scopes)) throw new Error("FORBIDDEN");
  const target = await db.user.findUnique({ where: { id: assigneeId }, select: { id: true } });
  if (!target) throw new Error("NOT_FOUND");
}

export async function createCalendarEvent(input: unknown): Promise<ActionResult<{ id: string }>> {
  return runAction(async () => {
    const user = await requireUser();
    const p = schema.safeParse(input);
    if (!p.success) throw new Error("VALIDATION");
    const d = p.data;

    const assigneeId = d.assigneeId || null;
    await assertCanAssign(user, assigneeId);

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

export async function updateCalendarEvent(input: unknown): Promise<ActionResult<{ id: string }>> {
  return runAction(async () => {
    const user = await requireUser();
    const p = z
      .object({
        id: z.string().min(1),
        title: z.string().trim().min(1).max(120),
        date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        startTime: z.string().regex(/^\d{2}:\d{2}$/),
        endTime: z.string().regex(/^\d{2}:\d{2}$/),
        kind: z.enum(KINDS),
        assigneeId: z.string().min(1).optional().nullable(),
        description: z.string().trim().max(500).optional().nullable()
      })
      .refine((d) => d.endTime >= d.startTime, { message: "END_BEFORE_START" })
      .safeParse(input);
    if (!p.success) throw new Error("VALIDATION");
    const d = p.data;

    const event = await db.calendarEvent.findUnique({
      where: { id: d.id },
      select: { id: true, provider: true, createdById: true, assigneeId: true, workItemId: true, leaveRequestId: true, reportId: true }
    });
    if (!event) throw new Error("NOT_FOUND");
    if (event.provider !== "INTERNAL" || event.workItemId || event.leaveRequestId || event.reportId) {
      throw new Error("SYSTEM_EVENT");
    }
    const isManager = user.role === Role.SUPER_ADMIN || user.role === Role.ADMIN;
    const isOwnerish = event.createdById === user.id || event.assigneeId === user.id;
    if (!isOwnerish && !isManager) throw new Error("FORBIDDEN");

    const assigneeId = d.assigneeId || null;
    await assertCanAssign(user, assigneeId);

    const meta = await requestMeta();
    await db.$transaction(async (tx) => {
      await tx.calendarEvent.update({
        where: { id: event.id },
        data: {
          title: d.title,
          description: d.description || null,
          startsAt: kstToUtc(d.date, d.startTime),
          endsAt: kstToUtc(d.date, d.endTime),
          kind: d.kind,
          assigneeId: assigneeId ?? event.assigneeId ?? user.id
        }
      });
      await recordAudit(tx, {
        actorId: user.id,
        action: "calendar.event.update",
        targetType: "CalendarEvent",
        targetId: event.id,
        afterState: { title: d.title, kind: d.kind, assigneeId: assigneeId ?? event.assigneeId },
        ...meta
      });
    });

    revalidatePath("/calendar");
    return { id: event.id };
  });
}

// .ics 가져오기 — 외부 캘린더(구글·애플·아웃룩·네이버) 파일을 내 일정으로 편입.
// 파일은 클라이언트가 텍스트로 읽어 넘긴다(FormData 미사용 — 폼 규약 일치).
// 편입된 일정은 INTERNAL로 저장되어 수정·삭제·재-내보내기 모두 가능하며,
// UID(externalEventId)로 dedup → 같은 파일 재업로드 시 중복 없이 갱신(멱등).
const IMPORT_MAX = 500; // 1회 최대 편입 건수(초과분은 잘라내고 보고).

const importSchema = z.object({
  icsText: z.string().min(1).max(3_000_000), // ~3MB 상한(대용량 캘린더 방어)
  kind: z.enum(KINDS).default("INTERNAL_INSTRUCTION")
});

export async function importCalendarIcs(
  input: unknown
): Promise<ActionResult<{ imported: number; updated: number; skipped: number; total: number; truncated: number }>> {
  return runAction(async () => {
    const user = await requireUser();
    const p = importSchema.safeParse(input);
    if (!p.success) throw new Error("VALIDATION");

    const parsed = parseIcs(p.data.icsText);
    if (!parsed.length) throw new Error("NO_EVENTS");
    const truncated = Math.max(0, parsed.length - IMPORT_MAX);
    const batch = parsed.slice(0, IMPORT_MAX);

    let imported = 0;
    let updated = 0;
    let skipped = 0;
    for (const ev of batch) {
      if (Number.isNaN(ev.startsAt.getTime()) || Number.isNaN(ev.endsAt.getTime())) {
        skipped++;
        continue;
      }
      const title = ev.title.slice(0, 200);
      // 종일 여부·장소를 메모 앞에 부기(원본 정보 보존).
      const noteParts = [ev.description, ev.location ? `장소: ${ev.location}` : null, ev.allDay ? "(종일)" : null].filter(Boolean);
      const description = noteParts.length ? noteParts.join("\n").slice(0, 2000) : null;
      const externalEventId = ev.uid ? `ics:${ev.uid}` : null;

      // dedup: 같은 UID를 내가 이전에 편입했으면 갱신, 아니면 신규.
      const existing = externalEventId
        ? await db.calendarEvent.findFirst({
            where: { externalEventId, createdById: user.id, provider: "INTERNAL" },
            select: { id: true }
          })
        : null;

      if (existing) {
        await db.calendarEvent.update({
          where: { id: existing.id },
          data: { title, description, startsAt: ev.startsAt, endsAt: ev.endsAt, kind: p.data.kind }
        });
        updated++;
      } else {
        await db.calendarEvent.create({
          data: {
            title,
            description,
            startsAt: ev.startsAt,
            endsAt: ev.endsAt,
            provider: "INTERNAL",
            kind: p.data.kind,
            createdById: user.id,
            assigneeId: user.id,
            externalEventId,
            syncStatus: "DISCONNECTED"
          }
        });
        imported++;
      }
    }

    const meta = await requestMeta();
    await recordAudit(db, {
      actorId: user.id,
      action: "calendar.ics.import",
      targetType: "CalendarEvent",
      targetId: user.id,
      afterState: { imported, updated, skipped, total: parsed.length },
      ...meta
    });

    revalidatePath("/calendar");
    return { imported, updated, skipped, total: parsed.length, truncated };
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
