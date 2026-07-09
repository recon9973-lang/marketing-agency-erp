// 목표 경로: src/server/actions/meetings.ts
//
// 회의록 — 회의 생성, 전사→AI 회의록 정리, 참석자 본인 체크인.
"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { Role } from "@/domain/types";
import { db } from "@/server/db";
import { generateMeetingMinutes } from "@/server/ai/claude";
import {
  recordAudit,
  requestMeta,
  requireUser,
  runAction,
  type ActionResult
} from "@/server/actions/_helpers";

const createSchema = z.object({
  title: z.string().trim().min(1).max(200),
  clientId: z.string().trim().optional().nullable(),
  meetingDate: z.string().trim().optional().nullable()
});

export async function createMeeting(input: unknown): Promise<ActionResult<{ id: string }>> {
  return runAction(async () => {
    const user = await requireUser();
    const p = createSchema.safeParse(input);
    if (!p.success) throw new Error("VALIDATION");
    const d = p.data;
    const clientId = d.clientId && d.clientId.length > 0 ? d.clientId : null;
    const meetingDate = d.meetingDate ? new Date(d.meetingDate) : new Date();

    const meeting = await db.meeting.create({
      data: { title: d.title, clientId, authorId: user.id, meetingDate },
      select: { id: true }
    });
    // 개설자는 자동 참석 처리.
    await db.meetingAttendee.create({ data: { meetingId: meeting.id, userId: user.id } }).catch(() => null);
    revalidatePath("/meetings");
    return { id: meeting.id };
  });
}

const minutesSchema = z.object({
  id: z.string().min(1),
  transcript: z.string().trim().min(1).max(200_000)
});

/** 전사/메모 원문을 저장하고 Claude로 회의록을 생성해 저장한다. */
export async function generateMeetingMinutesAction(input: unknown): Promise<ActionResult> {
  return runAction(async () => {
    const user = await requireUser();
    const p = minutesSchema.safeParse(input);
    if (!p.success) throw new Error("VALIDATION");

    const meeting = await db.meeting.findUnique({
      where: { id: p.data.id },
      include: { client: { select: { name: true } }, attendees: { include: { user: { select: { name: true } } } } }
    });
    if (!meeting) throw new Error("NOT_FOUND");

    const minutes = await generateMeetingMinutes(p.data.transcript, {
      title: meeting.title,
      clientName: meeting.client?.name ?? null,
      attendees: meeting.attendees.map((a) => a.user.name)
    });

    const meta = await requestMeta();
    await db.$transaction(async (tx) => {
      await tx.meeting.update({
        where: { id: p.data.id },
        data: { transcript: p.data.transcript, minutes, status: "DONE" }
      });
      await recordAudit(tx, {
        actorId: user.id,
        action: "meeting.minutes",
        targetType: "Meeting",
        targetId: p.data.id,
        afterState: { chars: p.data.transcript.length },
        ...meta
      });
    });
    revalidatePath(`/meetings/${p.data.id}`);
    revalidatePath("/meetings");
  });
}

/** 회의록 직접 수정(AI 결과 다듬기). */
export async function updateMeetingMinutes(input: unknown): Promise<ActionResult> {
  return runAction(async () => {
    await requireUser();
    const p = z.object({ id: z.string().min(1), minutes: z.string().trim().max(200_000) }).safeParse(input);
    if (!p.success) throw new Error("VALIDATION");
    await db.meeting.update({ where: { id: p.data.id }, data: { minutes: p.data.minutes } });
    revalidatePath(`/meetings/${p.data.id}`);
  });
}

/** 참석 체크인(본인). 이미 있으면 무시. */
export async function checkInMeeting(input: unknown): Promise<ActionResult> {
  return runAction(async () => {
    const user = await requireUser();
    const p = z.object({ id: z.string().min(1) }).safeParse(input);
    if (!p.success) throw new Error("VALIDATION");
    const meeting = await db.meeting.findUnique({ where: { id: p.data.id }, select: { id: true } });
    if (!meeting) throw new Error("NOT_FOUND");
    await db.meetingAttendee
      .create({ data: { meetingId: p.data.id, userId: user.id } })
      .catch(() => null); // 유니크 충돌은 이미 참석 → 무시
    revalidatePath(`/meetings/${p.data.id}`);
  });
}

/** 참석 취소(본인). */
export async function checkOutMeeting(input: unknown): Promise<ActionResult> {
  return runAction(async () => {
    const user = await requireUser();
    const p = z.object({ id: z.string().min(1) }).safeParse(input);
    if (!p.success) throw new Error("VALIDATION");
    await db.meetingAttendee.deleteMany({ where: { meetingId: p.data.id, userId: user.id } });
    revalidatePath(`/meetings/${p.data.id}`);
  });
}

export async function deleteMeeting(input: unknown): Promise<ActionResult> {
  return runAction(async () => {
    const user = await requireUser();
    const p = z.object({ id: z.string().min(1) }).safeParse(input);
    if (!p.success) throw new Error("VALIDATION");
    const meeting = await db.meeting.findUnique({ where: { id: p.data.id }, select: { authorId: true } });
    if (!meeting) throw new Error("NOT_FOUND");
    const isManager = user.role === Role.SUPER_ADMIN || user.role === Role.ADMIN;
    if (!isManager && meeting.authorId !== user.id) throw new Error("FORBIDDEN");
    await db.meeting.delete({ where: { id: p.data.id } });
    revalidatePath("/meetings");
  });
}
