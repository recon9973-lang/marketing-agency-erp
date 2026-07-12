// 목표 경로: src/server/jobs/daily-alerts.ts
//
// 일일 알림 스위프(기획서 §7 KPI·알림, §15 운영규칙) — 크론에서 하루 1회 호출.
// 조회형 배지만 있던 규칙을 Notification(알림벨)으로 발송한다:
//  ① 업무 마감 D-1 / 지연 D+1 — 담당자에게
//  ② 병원 승인 대기 3영업일 초과(REVIEWED·미컨펌) — 담당 마케터에게
//  ③ 리드 재접촉 예정일 도래 — 담당 AE에게
// 멱등: 같은 대상에 대해 같은 날 이미 보낸 알림(targetType+targetId+type, 오늘 생성)은 건너뜀.

import { db } from "@/server/db";
import { businessDaysBetween } from "@/server/repositories/dashboard-extras";

const DAY_MS = 24 * 60 * 60 * 1000;

function dayStart(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

async function alreadySentToday(userId: string, type: string, targetId: string, todayStart: Date): Promise<boolean> {
  const existing = await db.notification.findFirst({
    where: { userId, type, targetId, createdAt: { gte: todayStart } },
    select: { id: true }
  });
  return Boolean(existing);
}

export type DailyAlertResult = { dueSoon: number; overdue: number; approvalWait: number; recontact: number };

export async function runDailyAlerts(now = new Date()): Promise<DailyAlertResult> {
  const todayStart = dayStart(now);
  const tomorrowStart = new Date(todayStart.getTime() + DAY_MS);
  const dayAfterStart = new Date(todayStart.getTime() + 2 * DAY_MS);
  const result: DailyAlertResult = { dueSoon: 0, overdue: 0, approvalWait: 0, recontact: 0 };

  // ① 마감 D-1(내일 마감) + 지연(마감 지남) — 미완료 업무의 담당자에게
  const openWork = await db.workItem.findMany({
    where: {
      status: { notIn: ["COMPLETED"] },
      dueDate: { not: null, lt: dayAfterStart }
    },
    select: { id: true, title: true, dueDate: true, ownerId: true, clientId: true, client: { select: { name: true } } },
    take: 300
  });
  for (const w of openWork) {
    if (!w.dueDate) continue;
    const isDueSoon = w.dueDate >= tomorrowStart && w.dueDate < dayAfterStart;
    const isOverdue = w.dueDate < todayStart;
    if (!isDueSoon && !isOverdue) continue;
    const type = isOverdue ? "WORK_OVERDUE" : "WORK_DUE_SOON";
    if (await alreadySentToday(w.ownerId, type, w.id, todayStart)) continue;
    await db.notification.create({
      data: {
        userId: w.ownerId,
        type,
        title: isOverdue ? `지연 업무: ${w.title}` : `내일 마감: ${w.title}`,
        body: `${w.client.name} · 마감 ${w.dueDate.toISOString().slice(0, 10)}`,
        link: "/work",
        targetType: "WorkItem",
        targetId: w.id
      }
    });
    if (isOverdue) result.overdue++;
    else result.dueSoon++;
  }

  // ② 병원 승인 대기 3영업일 초과 — 담당 마케터에게(§15)
  const waiting = await db.contentPlan.findMany({
    where: { status: "REVIEWED", clientConfirmedAt: null },
    select: { id: true, topic: true, updatedAt: true, client: { select: { id: true, name: true, assignedMarketerId: true } } },
    take: 200
  });
  for (const plan of waiting) {
    if (businessDaysBetween(plan.updatedAt, now) < 3) continue;
    const userId = plan.client.assignedMarketerId;
    if (!userId) continue;
    if (await alreadySentToday(userId, "CLIENT_APPROVAL_OVERDUE", plan.id, todayStart)) continue;
    await db.notification.create({
      data: {
        userId,
        type: "CLIENT_APPROVAL_OVERDUE",
        title: `병원 승인 3영업일 초과: ${plan.topic}`,
        body: `${plan.client.name} — 병원 담당자에게 컨펌을 다시 요청해주세요.`,
        link: `/clients/${plan.client.id}`,
        targetType: "ContentPlan",
        targetId: plan.id
      }
    });
    result.approvalWait++;
  }

  // ③ 리드 재접촉 예정일 도래 — 담당 AE에게
  const recontacts = await db.lead.findMany({
    where: { status: "RECONTACT", nextActionAt: { not: null, lt: tomorrowStart }, assigneeId: { not: null } },
    select: { id: true, hospitalName: true, nextActionAt: true, assigneeId: true },
    take: 200
  });
  for (const lead of recontacts) {
    const userId = lead.assigneeId;
    if (!userId) continue;
    if (await alreadySentToday(userId, "LEAD_RECONTACT_DUE", lead.id, todayStart)) continue;
    await db.notification.create({
      data: {
        userId,
        type: "LEAD_RECONTACT_DUE",
        title: `재접촉 예정: ${lead.hospitalName}`,
        body: `예정일 ${lead.nextActionAt?.toISOString().slice(0, 10)} — 접촉 후 상태를 업데이트해주세요.`,
        link: `/leads/${lead.id}`,
        targetType: "Lead",
        targetId: lead.id
      }
    });
    result.recontact++;
  }

  return result;
}
