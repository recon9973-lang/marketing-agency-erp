// 채팅 조회 — 방 목록/메시지/직원. 테이블 미생성 등에도 화면이 죽지 않게 방어([] 반환).
import { db } from "@/server/db";
import { Role, UserStatus } from "@/domain/types";

export type ChatRoomRow = { id: string; type: string; title: string; lastMessageAt: string | null };
export type ChatMessageRow = { id: string; senderId: string; senderName: string; body: string; createdAt: string };
export type StaffLite = { id: string; name: string; role: string };

export async function listChatRooms(userId: string): Promise<ChatRoomRow[]> {
  try {
    const memberships = await db.chatMember.findMany({
      where: { userId },
      select: {
        room: {
          select: {
            id: true,
            type: true,
            name: true,
            lastMessageAt: true,
            members: { select: { userId: true, user: { select: { name: true } } } }
          }
        }
      }
    });
    const rows = memberships
      .map((m) => m.room)
      .filter((r): r is NonNullable<typeof r> => Boolean(r))
      .map((r) => {
        const others = r.members.filter((mm) => mm.userId !== userId);
        const title = r.type === "GROUP" ? r.name || "채널" : others[0]?.user.name ?? "1:1 대화";
        return { id: r.id, type: r.type as string, title, lastMessageAt: r.lastMessageAt ? r.lastMessageAt.toISOString() : null };
      });
    rows.sort((a, b) => (b.lastMessageAt ?? "").localeCompare(a.lastMessageAt ?? ""));
    return rows;
  } catch {
    return [];
  }
}

export async function isRoomMember(roomId: string, userId: string): Promise<boolean> {
  try {
    const m = await db.chatMember.findUnique({ where: { roomId_userId: { roomId, userId } }, select: { id: true } });
    return Boolean(m);
  } catch {
    return false;
  }
}

export async function listChatMessages(roomId: string, userId: string): Promise<ChatMessageRow[]> {
  if (!(await isRoomMember(roomId, userId))) return [];
  try {
    const rows = await db.chatMessage.findMany({
      where: { roomId },
      orderBy: { createdAt: "asc" },
      take: 200,
      select: { id: true, senderId: true, body: true, createdAt: true, sender: { select: { name: true } } }
    });
    return rows.map((r) => ({ id: r.id, senderId: r.senderId, senderName: r.sender?.name ?? "?", body: r.body, createdAt: r.createdAt.toISOString() }));
  } catch {
    return [];
  }
}

export async function listStaffForChat(userId: string): Promise<StaffLite[]> {
  try {
    const rows = await db.user.findMany({
      where: { id: { not: userId }, status: UserStatus.ACTIVE, role: { in: [Role.SUPER_ADMIN, Role.ADMIN, Role.MARKETER] } },
      orderBy: { name: "asc" },
      select: { id: true, name: true, role: true }
    });
    return rows.map((r) => ({ id: r.id, name: r.name, role: r.role }));
  } catch {
    return [];
  }
}
