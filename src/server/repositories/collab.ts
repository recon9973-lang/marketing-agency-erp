import { UserStatus } from "@/domain/types";
import { db } from "@/server/db";

export const COMMENT_TARGETS = ["CLIENT", "WORK", "REPORT", "CONTRACT"] as const;
export type CommentTarget = (typeof COMMENT_TARGETS)[number];

export type CommentItem = {
  id: string;
  body: string;
  authorId: string;
  authorName: string;
  createdAt: Date;
};

export type MemberOption = { id: string; name: string };

export type NotificationItem = {
  id: string;
  type: string;
  title: string;
  body: string | null;
  link: string | null;
  isRead: boolean;
  actorName: string | null;
  createdAt: Date;
};

/** 특정 대상(거래처/업무/보고서/계약)에 달린 댓글 목록(오래된 순). */
export async function listComments(targetType: string, targetId: string): Promise<CommentItem[]> {
  const rows = await db.comment.findMany({
    where: { targetType, targetId },
    orderBy: { createdAt: "asc" },
    take: 200,
    select: { id: true, body: true, authorId: true, createdAt: true, author: { select: { name: true } } }
  });
  return rows.map((c) => ({
    id: c.id,
    body: c.body,
    authorId: c.authorId,
    authorName: c.author.name,
    createdAt: c.createdAt
  }));
}

/** 멘션 대상으로 쓸 활성 직원 목록. */
export async function listActiveMembers(): Promise<MemberOption[]> {
  const rows = await db.user.findMany({
    where: { status: UserStatus.ACTIVE, isActive: true },
    orderBy: { name: "asc" },
    select: { id: true, name: true }
  });
  return rows.map((u) => ({ id: u.id, name: u.name }));
}

/** 수신자 기준 최근 알림 목록. */
export async function listNotificationsForUser(userId: string, limit = 20): Promise<NotificationItem[]> {
  const rows = await db.notification.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: limit,
    select: {
      id: true,
      type: true,
      title: true,
      body: true,
      link: true,
      isRead: true,
      createdAt: true,
      actor: { select: { name: true } }
    }
  });
  return rows.map((n) => ({
    id: n.id,
    type: n.type,
    title: n.title,
    body: n.body,
    link: n.link,
    isRead: n.isRead,
    actorName: n.actor?.name ?? null,
    createdAt: n.createdAt
  }));
}

export async function countUnreadNotifications(userId: string): Promise<number> {
  return db.notification.count({ where: { userId, isRead: false } });
}
