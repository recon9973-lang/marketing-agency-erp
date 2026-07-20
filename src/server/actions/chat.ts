"use server";

// 내부 채팅 — 1:1(DIRECT)·팀 채널(GROUP). 폴링 기반(실시간 웹소켓 아님).
import { z } from "zod";

import { db } from "@/server/db";
import { requireUser, runAction, type ActionResult } from "@/server/actions/_helpers";
import { isRoomMember, listChatMessages, type ChatMessageRow } from "@/server/repositories/chat";

// 채팅 테이블 자가치유(멱등). enum·테이블 각각 개별 실행(존재 시 실패 무시).
async function ensureTables(): Promise<void> {
  const stmts = [
    `CREATE TYPE "ChatRoomType" AS ENUM ('DIRECT', 'GROUP')`,
    `CREATE TABLE IF NOT EXISTS "ChatRoom" ("id" TEXT NOT NULL, "type" "ChatRoomType" NOT NULL DEFAULT 'DIRECT', "name" TEXT, "clientId" TEXT, "createdById" TEXT, "lastMessageAt" TIMESTAMP(3), "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "ChatRoom_pkey" PRIMARY KEY ("id"))`,
    `CREATE INDEX IF NOT EXISTS "ChatRoom_lastMessageAt_idx" ON "ChatRoom" ("lastMessageAt")`,
    `CREATE TABLE IF NOT EXISTS "ChatMember" ("id" TEXT NOT NULL, "roomId" TEXT NOT NULL, "userId" TEXT NOT NULL, "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "lastReadAt" TIMESTAMP(3), CONSTRAINT "ChatMember_pkey" PRIMARY KEY ("id"))`,
    `CREATE UNIQUE INDEX IF NOT EXISTS "ChatMember_roomId_userId_key" ON "ChatMember" ("roomId", "userId")`,
    `CREATE INDEX IF NOT EXISTS "ChatMember_userId_idx" ON "ChatMember" ("userId")`,
    `CREATE TABLE IF NOT EXISTS "ChatMessage" ("id" TEXT NOT NULL, "roomId" TEXT NOT NULL, "senderId" TEXT NOT NULL, "body" TEXT NOT NULL, "fileId" TEXT, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "ChatMessage_pkey" PRIMARY KEY ("id"))`,
    `CREATE INDEX IF NOT EXISTS "ChatMessage_roomId_createdAt_idx" ON "ChatMessage" ("roomId", "createdAt")`
  ];
  for (const s of stmts) {
    try {
      await db.$executeRawUnsafe(s);
    } catch {
      /* 이미 존재 등 무시 */
    }
  }
}

/** 1:1 대화 시작(있으면 재사용). */
export async function startDirect(input: unknown): Promise<ActionResult<{ roomId: string }>> {
  return runAction(async () => {
    const user = await requireUser();
    const p = z.object({ otherUserId: z.string().min(1) }).safeParse(input);
    if (!p.success) throw new Error("VALIDATION");
    if (p.data.otherUserId === user.id) throw new Error("VALIDATION");
    await ensureTables();

    const rooms = await db.chatRoom.findMany({
      where: { type: "DIRECT", AND: [{ members: { some: { userId: user.id } } }, { members: { some: { userId: p.data.otherUserId } } }] },
      select: { id: true, members: { select: { userId: true } } }
    });
    const exact = rooms.find((r) => r.members.length === 2);
    if (exact) return { roomId: exact.id };

    const room = await db.chatRoom.create({
      data: { type: "DIRECT", createdById: user.id, members: { create: [{ userId: user.id }, { userId: p.data.otherUserId }] } }
    });
    return { roomId: room.id };
  });
}

/** 팀 채널 생성. */
export async function createChannel(input: unknown): Promise<ActionResult<{ roomId: string }>> {
  return runAction(async () => {
    const user = await requireUser();
    const p = z.object({ name: z.string().trim().min(1).max(60), memberIds: z.array(z.string()).default([]) }).safeParse(input);
    if (!p.success) throw new Error("VALIDATION");
    await ensureTables();
    const ids = [...new Set([user.id, ...p.data.memberIds])];
    const room = await db.chatRoom.create({
      data: { type: "GROUP", name: p.data.name, createdById: user.id, members: { create: ids.map((id) => ({ userId: id })) } }
    });
    return { roomId: room.id };
  });
}

/** 메시지 전송. */
export async function sendChatMessage(input: unknown): Promise<ActionResult> {
  return runAction(async () => {
    const user = await requireUser();
    const p = z.object({ roomId: z.string().min(1), body: z.string().trim().min(1).max(4000) }).safeParse(input);
    if (!p.success) throw new Error("VALIDATION");
    await ensureTables();
    if (!(await isRoomMember(p.data.roomId, user.id))) throw new Error("FORBIDDEN");
    await db.chatMessage.create({ data: { roomId: p.data.roomId, senderId: user.id, body: p.data.body } });
    await db.chatRoom.update({ where: { id: p.data.roomId }, data: { lastMessageAt: new Date() } }).catch(() => undefined);
  });
}

/** 방 메시지 조회(폴링용) — 읽음 시각도 갱신. */
export async function getRoomMessages(input: unknown): Promise<ActionResult<ChatMessageRow[]>> {
  return runAction(async () => {
    const user = await requireUser();
    const p = z.object({ roomId: z.string().min(1) }).safeParse(input);
    if (!p.success) throw new Error("VALIDATION");
    const messages = await listChatMessages(p.data.roomId, user.id);
    await db.chatMember
      .update({ where: { roomId_userId: { roomId: p.data.roomId, userId: user.id } }, data: { lastReadAt: new Date() } })
      .catch(() => undefined);
    return messages;
  });
}
