import { workStatusLabels } from "@/domain/work";
import { db } from "@/server/db";

/**
 * 거래처 상세 최근 활동 타임라인 (워크플로우 16차).
 * 업무·보고서·플레이스 순위·협업방을 시간순으로 합쳐 보여준다.
 * 단일 거래처 조회이므로 접근 제어는 호출 측(거래처 접근 확인)에서 담당한다.
 */

export type ActivityItem = {
  key: string;
  kind: string;
  at: Date;
  title: string;
  subtitle: string | null;
  href: string;
};

const reportStatusLabel: Record<string, string> = {
  DRAFT: "초안",
  REVIEW_NEEDED: "검토필요",
  APPROVED: "승인",
  DELIVERED: "전달완료"
};

export async function getClientActivity(clientId: string, limit = 8): Promise<ActivityItem[]> {
  const [work, reports, ranks, rooms] = await Promise.all([
    db.workItem.findMany({
      where: { clientId },
      orderBy: { updatedAt: "desc" },
      take: limit,
      select: { id: true, title: true, status: true, updatedAt: true }
    }),
    db.report.findMany({
      where: { clientId },
      orderBy: { updatedAt: "desc" },
      take: limit,
      select: { id: true, title: true, status: true, updatedAt: true }
    }),
    db.placeRankRecord.findMany({
      where: { clientId },
      orderBy: [{ recordedOn: "desc" }, { createdAt: "desc" }],
      take: limit,
      select: { id: true, keyword: true, rank: true, recordedOn: true }
    }),
    db.chatRoom.findMany({
      where: { clientId },
      orderBy: { lastMessageAt: "desc" },
      take: limit,
      select: { id: true, name: true, lastMessageAt: true, createdAt: true }
    })
  ]);

  const items: ActivityItem[] = [];

  for (const item of work) {
    items.push({
      key: `work-${item.id}`,
      kind: "📋 업무",
      at: item.updatedAt,
      title: item.title,
      subtitle: workStatusLabels[item.status] ?? item.status,
      href: `/work/${item.id}/edit`
    });
  }

  for (const report of reports) {
    items.push({
      key: `report-${report.id}`,
      kind: "📄 보고서",
      at: report.updatedAt,
      title: report.title,
      subtitle: reportStatusLabel[report.status] ?? report.status,
      href: `/reports/${report.id}/edit`
    });
  }

  for (const rank of ranks) {
    items.push({
      key: `rank-${rank.id}`,
      kind: "📍 순위",
      at: rank.recordedOn,
      title: rank.keyword,
      subtitle: `${rank.rank}위`,
      href: `/clients/${clientId}/ranks`
    });
  }

  for (const room of rooms) {
    items.push({
      key: `room-${room.id}`,
      kind: "💬 협업방",
      at: room.lastMessageAt ?? room.createdAt,
      title: room.name ?? "협업방",
      subtitle: room.lastMessageAt ? "최근 대화" : "생성됨",
      href: `/messages/${room.id}`
    });
  }

  return items.sort((a, b) => b.at.getTime() - a.at.getTime()).slice(0, limit);
}
