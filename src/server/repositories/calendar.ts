import type { Prisma } from "@prisma/client";
import { CalendarEventKind, CalendarProvider, ConnectionStatus, Role } from "@/domain/types";
import { db } from "@/server/db";
import type { CurrentUser } from "@/server/session";

type AdminScope = {
  clientId: string | null;
  marketerId: string | null;
  allClients: boolean;
  allMarketers: boolean;
};

export type CalendarListItem = {
  id: string;
  title: string;
  description: string | null;
  startsAt: Date;
  endsAt: Date;
  provider: CalendarProvider;
  kind: CalendarEventKind;
  syncStatus: ConnectionStatus;
  clientName: string | null;
  assigneeId: string | null;
  // 사람이 만든 독립 일정만 수정·삭제 가능(업무·연차·리포트 연결 이벤트는 원천에서만 관리).
  editable: boolean;
};

export const calendarKindLabels: Record<CalendarEventKind, string> = {
  [CalendarEventKind.TASK]: "업무 마감",
  [CalendarEventKind.CLIENT_MEETING]: "고객 미팅",
  [CalendarEventKind.REPORT_DEADLINE]: "보고서 마감",
  [CalendarEventKind.LEAVE]: "연차/휴가",
  [CalendarEventKind.INTERNAL_INSTRUCTION]: "업무 지시"
};

function unique(values: Array<string | null>) {
  return [...new Set(values.filter((value): value is string => Boolean(value)))];
}

function buildAdminCalendarWhere(scopes: AdminScope[]) {
  const allClients = scopes.some((scope) => scope.allClients);
  const allMarketers = scopes.some((scope) => scope.allMarketers);

  if (allClients && allMarketers) {
    return {};
  }

  const clientIds = unique(scopes.map((scope) => scope.clientId));
  const marketerIds = unique(scopes.map((scope) => scope.marketerId));
  const clauses: Prisma.CalendarEventWhereInput[] = [];

  if (allClients) {
    clauses.push({ clientId: { not: null } });
    clauses.push({ workItemId: { not: null } });
  } else if (clientIds.length > 0) {
    clauses.push({ clientId: { in: clientIds } });
    clauses.push({ workItem: { is: { clientId: { in: clientIds } } } });
  }

  if (allMarketers) {
    clauses.push({ leaveRequestId: { not: null } });
    clauses.push({ workItemId: { not: null } });
    clauses.push({ client: { is: { assignedMarketerId: { not: null } } } });
  } else if (marketerIds.length > 0) {
    clauses.push({ leaveRequest: { is: { requesterId: { in: marketerIds } } } });
    clauses.push({ workItem: { is: { ownerId: { in: marketerIds } } } });
    clauses.push({ client: { is: { assignedMarketerId: { in: marketerIds } } } });
    clauses.push({ assigneeId: { in: marketerIds } });
  }
  if (allMarketers) {
    clauses.push({ assigneeId: { not: null } });
  }

  return clauses.length > 0 ? { OR: clauses } : { id: { in: [] } };
}

async function buildCalendarWhere(user: CurrentUser) {
  if (user.role === Role.SUPER_ADMIN) {
    return {};
  }

  if (user.role === Role.MARKETER) {
    return {
      OR: [
        { createdById: user.id },
        { assigneeId: user.id },
        { workItem: { is: { ownerId: user.id } } },
        { client: { is: { assignedMarketerId: user.id } } },
        { leaveRequest: { is: { requesterId: user.id } } }
      ]
    };
  }

  const scopes = await db.accessScope.findMany({
    where: { adminId: user.id },
    select: {
      clientId: true,
      marketerId: true,
      allClients: true,
      allMarketers: true
    }
  });

  return buildAdminCalendarWhere(scopes);
}

export type TeamCalendarItem = CalendarListItem & { ownerName: string };

/** 관리자 담당자별 팀 일정 — 이벤트 소유자를 workItem.owner·leaveRequest.requester·createdBy에서
 *  파생(스키마 무변경). 스코프는 기존 buildCalendarWhere 재사용(SUPER_ADMIN=전체, ADMIN=범위). */
export async function fetchTeamCalendarEvents(user: CurrentUser): Promise<TeamCalendarItem[]> {
  if (user.role === Role.MARKETER) return []; // 담당자 본인은 개인 뷰만
  const events = await db.calendarEvent.findMany({
    where: await buildCalendarWhere(user),
    orderBy: { startsAt: "asc" },
    take: 200,
    select: {
      id: true,
      title: true,
      description: true,
      startsAt: true,
      endsAt: true,
      provider: true,
      kind: true,
      syncStatus: true,
      createdById: true,
      assigneeId: true,
      workItemId: true,
      leaveRequestId: true,
      reportId: true,
      client: { select: { name: true } },
      assignee: { select: { name: true } },
      workItem: { select: { owner: { select: { name: true } } } },
      leaveRequest: { select: { requester: { select: { name: true } } } },
      createdBy: { select: { name: true } }
    }
  });

  // 관리자 뷰 — 스코프 내 독립 이벤트는 수정·삭제 가능(시스템 이벤트 제외).
  return events.map((event) => ({
    id: event.id,
    title: event.title,
    description: event.description,
    startsAt: event.startsAt,
    endsAt: event.endsAt,
    provider: event.provider,
    kind: event.kind,
    syncStatus: event.syncStatus,
    clientName: event.client?.name ?? null,
    assigneeId: event.assigneeId,
    editable:
      event.provider === CalendarProvider.INTERNAL &&
      !event.workItemId &&
      !event.leaveRequestId &&
      !event.reportId,
    // 직접 배정(assignee) 우선 → 업무 담당자 → 연차 신청자 → 생성자 순으로 파생.
    ownerName: event.assignee?.name ?? event.workItem?.owner?.name ?? event.leaveRequest?.requester?.name ?? event.createdBy?.name ?? "미배정"
  }));
}

export type MiniCalendarEvent = { day: number; kind: CalendarEventKind; title: string; time: string };

/** 대시보드 미니 캘린더용 — 지정 기간 이벤트(일자·종류·제목·시각). 스코프는 buildCalendarWhere 재사용. */
export async function fetchMonthCalendarEvents(user: CurrentUser, start: Date, end: Date): Promise<MiniCalendarEvent[]> {
  try {
    const scope = await buildCalendarWhere(user);
    const events = await db.calendarEvent.findMany({
      where: { AND: [scope, { startsAt: { gte: start, lt: end } }] },
      orderBy: { startsAt: "asc" },
      select: { startsAt: true, kind: true, title: true },
      take: 300
    });
    return events.map((e) => ({
      day: e.startsAt.getDate(),
      kind: e.kind,
      title: e.title,
      time: new Intl.DateTimeFormat("ko-KR", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Seoul" }).format(e.startsAt)
    }));
  } catch {
    return [];
  }
}

export type IcsExportEvent = { id: string; title: string; description: string | null; startsAt: Date; endsAt: Date };

/** .ics 내보내기용 — 스코프 내 이벤트를 [now-30d, now+180d] 범위로. 최대 500건. */
export async function fetchCalendarEventsForExport(user: CurrentUser, now: Date): Promise<IcsExportEvent[]> {
  const from = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const to = new Date(now.getTime() + 180 * 24 * 60 * 60 * 1000);
  const scope = await buildCalendarWhere(user);
  const events = await db.calendarEvent.findMany({
    where: { AND: [scope, { startsAt: { gte: from, lte: to } }] },
    orderBy: { startsAt: "asc" },
    take: 500,
    select: { id: true, title: true, description: true, startsAt: true, endsAt: true }
  });
  return events;
}

export async function fetchCalendarEventsForUser(user: CurrentUser): Promise<CalendarListItem[]> {
  const events = await db.calendarEvent.findMany({
    where: await buildCalendarWhere(user),
    orderBy: { startsAt: "asc" },
    take: 50,
    select: {
      id: true,
      title: true,
      description: true,
      startsAt: true,
      endsAt: true,
      provider: true,
      kind: true,
      syncStatus: true,
      createdById: true,
      assigneeId: true,
      workItemId: true,
      leaveRequestId: true,
      reportId: true,
      client: {
        select: { name: true }
      }
    }
  });

  const isManager = user.role === Role.SUPER_ADMIN || user.role === Role.ADMIN;
  return events.map((event) => ({
    id: event.id,
    title: event.title,
    description: event.description,
    startsAt: event.startsAt,
    endsAt: event.endsAt,
    provider: event.provider,
    kind: event.kind,
    syncStatus: event.syncStatus,
    clientName: event.client?.name ?? null,
    assigneeId: event.assigneeId,
    // 독립 INTERNAL 이벤트 + (관리자 또는 생성자/담당자 본인)일 때만 수정·삭제 허용.
    editable:
      event.provider === CalendarProvider.INTERNAL &&
      !event.workItemId &&
      !event.leaveRequestId &&
      !event.reportId &&
      (isManager || event.createdById === user.id || event.assigneeId === user.id)
  }));
}
