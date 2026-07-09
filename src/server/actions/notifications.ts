// 목표 경로: src/server/actions/notifications.ts
//
// 알림센터 — 헤더 벨이 폴링으로 불러오고(getMyNotifications), 읽음 처리한다.
"use server";

import { z } from "zod";

import { db } from "@/server/db";
import {
  countUnreadNotifications,
  listNotificationsForUser,
  type NotificationItem
} from "@/server/repositories/collab";
import { requireUser, runAction, type ActionResult } from "@/server/actions/_helpers";
import { getCurrentUser } from "@/server/session";

export type MyNotifications = { items: NotificationItem[]; unread: number };

/** 헤더 벨용 — 최근 알림 + 읽지 않은 개수. 비로그인/오류 시 빈 값. */
export async function getMyNotifications(): Promise<MyNotifications> {
  const user = await getCurrentUser().catch(() => null);
  if (!user) return { items: [], unread: 0 };
  try {
    const [items, unread] = await Promise.all([
      listNotificationsForUser(user.id, 20),
      countUnreadNotifications(user.id)
    ]);
    return { items, unread };
  } catch {
    return { items: [], unread: 0 };
  }
}

export async function markNotificationRead(input: unknown): Promise<ActionResult> {
  return runAction(async () => {
    const user = await requireUser();
    const p = z.object({ id: z.string().min(1) }).safeParse(input);
    if (!p.success) throw new Error("VALIDATION");
    // 본인 알림만 갱신(updateMany로 소유권 조건 포함).
    await db.notification.updateMany({
      where: { id: p.data.id, userId: user.id },
      data: { isRead: true }
    });
  });
}

export async function markAllNotificationsRead(): Promise<ActionResult> {
  return runAction(async () => {
    const user = await requireUser();
    await db.notification.updateMany({
      where: { userId: user.id, isRead: false },
      data: { isRead: true }
    });
  });
}
