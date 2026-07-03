import { ChatRoomType, UserStatus } from "@/domain/types";
import { db } from "@/server/db";

export type ChatRoomListItem = {
  id: string;
  type: ChatRoomType;
  /** 표시 이름: 그룹은 방 이름, 1:1은 상대 이름. */
  displayName: string;
  lastMessageBody: string | null;
  lastMessageAt: Date | null;
  unreadCount: number;
};

export type ChatRoomDetail = {
  id: string;
  type: ChatRoomType;
  displayName: string;
  members: Array<{ userId: string; name: string }>;
  client: { id: string; name: string } | null;
};

export type ChatMessageFile = {
  id: string;
  fileName: string;
  mimeType: string;
  size: number;
};

export type ChatMessageItem = {
  id: string;
  senderId: string;
  senderName: string;
  body: string;
  file: ChatMessageFile | null;
  createdAt: Date;
};

function directDisplayName(members: Array<{ userId: string; name: string }>, meId: string) {
  const other = members.find((member) => member.userId !== meId);
  return other?.name ?? "알 수 없는 사용자";
}

/** 내가 참여한 대화방 목록 (최근 메시지 순, 안읽음 수 포함). */
export async function listRoomsForUser(userId: string): Promise<ChatRoomListItem[]> {
  const memberships = await db.chatMember.findMany({
    where: { userId },
    select: {
      lastReadAt: true,
      room: {
        select: {
          id: true,
          type: true,
          name: true,
          lastMessageAt: true,
          members: { select: { userId: true, user: { select: { name: true } } } },
          messages: {
            orderBy: { createdAt: "desc" },
            take: 1,
            select: { body: true }
          }
        }
      }
    }
  });

  const rooms = await Promise.all(
    memberships.map(async (membership) => {
      const room = membership.room;
      const unreadCount = await db.chatMessage.count({
        where: {
          roomId: room.id,
          senderId: { not: userId },
          ...(membership.lastReadAt ? { createdAt: { gt: membership.lastReadAt } } : {})
        }
      });

      const members = room.members.map((member) => ({ userId: member.userId, name: member.user.name }));

      return {
        id: room.id,
        type: room.type,
        displayName:
          room.type === ChatRoomType.GROUP ? (room.name ?? "협업방") : directDisplayName(members, userId),
        lastMessageBody: room.messages[0]?.body ?? null,
        lastMessageAt: room.lastMessageAt,
        unreadCount
      };
    })
  );

  return rooms.sort((a, b) => (b.lastMessageAt?.getTime() ?? 0) - (a.lastMessageAt?.getTime() ?? 0));
}

/** 방 상세(멤버 확인 포함). 멤버가 아니면 null. */
export async function getRoomForUser(roomId: string, userId: string): Promise<ChatRoomDetail | null> {
  const room = await db.chatRoom.findUnique({
    where: { id: roomId },
    select: {
      id: true,
      type: true,
      name: true,
      client: { select: { id: true, name: true } },
      members: { select: { userId: true, user: { select: { name: true } } } }
    }
  });

  if (!room || !room.members.some((member) => member.userId === userId)) {
    return null;
  }

  const members = room.members.map((member) => ({ userId: member.userId, name: member.user.name }));

  return {
    id: room.id,
    type: room.type,
    displayName:
      room.type === ChatRoomType.GROUP ? (room.name ?? "협업방") : directDisplayName(members, userId),
    members,
    client: room.client
  };
}

export async function listMessages(roomId: string, take = 100): Promise<ChatMessageItem[]> {
  const messages = await db.chatMessage.findMany({
    where: { roomId },
    orderBy: { createdAt: "desc" },
    take,
    select: {
      id: true,
      senderId: true,
      body: true,
      createdAt: true,
      sender: { select: { name: true } },
      file: { select: { id: true, fileName: true, mimeType: true, size: true } }
    }
  });

  return messages.reverse().map((message) => ({
    id: message.id,
    senderId: message.senderId,
    senderName: message.sender.name,
    body: message.body,
    file: message.file,
    createdAt: message.createdAt
  }));
}

/** 두 사용자의 기존 1:1 방을 찾는다. */
export async function findDirectRoom(userIdA: string, userIdB: string): Promise<string | null> {
  const room = await db.chatRoom.findFirst({
    where: {
      type: ChatRoomType.DIRECT,
      AND: [{ members: { some: { userId: userIdA } } }, { members: { some: { userId: userIdB } } }]
    },
    select: { id: true }
  });

  return room?.id ?? null;
}

export async function createDirectRoom(creatorId: string, otherUserId: string): Promise<string> {
  const room = await db.chatRoom.create({
    data: {
      type: ChatRoomType.DIRECT,
      createdById: creatorId,
      members: { create: [{ userId: creatorId }, { userId: otherUserId }] }
    },
    select: { id: true }
  });

  return room.id;
}

/** 협업방(그룹) 생성. 생성자는 자동으로 멤버에 포함된다. */
export async function createGroupRoom(
  creatorId: string,
  name: string,
  memberIds: string[],
  clientId?: string
): Promise<string> {
  const uniqueMembers = [...new Set([creatorId, ...memberIds])];

  const room = await db.chatRoom.create({
    data: {
      type: ChatRoomType.GROUP,
      name,
      clientId: clientId ?? null,
      createdById: creatorId,
      members: { create: uniqueMembers.map((userId) => ({ userId })) }
    },
    select: { id: true }
  });

  return room.id;
}

/** 주어진 id 중 활성 직원의 id 목록을 반환한다. */
export async function getActiveUserIds(userIds: string[]): Promise<string[]> {
  const users = await db.user.findMany({
    where: { id: { in: userIds }, isActive: true, status: UserStatus.ACTIVE },
    select: { id: true }
  });

  return users.map((user) => user.id);
}

export async function createMessage(roomId: string, senderId: string, body: string, fileId?: string) {
  const now = new Date();
  const [message] = await db.$transaction([
    db.chatMessage.create({
      data: { roomId, senderId, body, fileId: fileId ?? null },
      select: { id: true }
    }),
    db.chatRoom.update({ where: { id: roomId }, data: { lastMessageAt: now } }),
    db.chatMember.updateMany({ where: { roomId, userId: senderId }, data: { lastReadAt: now } })
  ]);

  return message;
}

/** 방을 읽음 처리한다(idempotent). */
export async function markRoomRead(roomId: string, userId: string) {
  await db.chatMember.updateMany({ where: { roomId, userId }, data: { lastReadAt: new Date() } });
}

/** 대화 상대 선택용 활성 직원 목록(본인 제외). */
export async function listChatPartners(meId: string) {
  return db.user.findMany({
    where: { id: { not: meId }, isActive: true, status: UserStatus.ACTIVE },
    orderBy: { name: "asc" },
    select: { id: true, name: true, role: true }
  });
}

export async function getActiveUser(userId: string) {
  return db.user.findFirst({
    where: { id: userId, isActive: true, status: UserStatus.ACTIVE },
    select: { id: true, name: true }
  });
}
