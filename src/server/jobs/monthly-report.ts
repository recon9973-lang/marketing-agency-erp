// 목표 경로: src/server/jobs/monthly-report.ts
//
// 월간 보고서 자동 초안 배치 — 월초 크론에서 전 활성 거래처의 "지난달" 보고서를 DRAFT로 생성.
// 발행·전달(DELIVERED)은 사람 검토 후에만(매거진 자동초안과 동일한 안전 원칙).
// 멱등: 이미 있는 (거래처×월) 보고서는 건너뛴다(Report @@unique). 거래처별 실패는 격리.

import { db } from "@/server/db";
import { buildMonthlyReportDraft } from "@/server/marketing/monthly-report";

export type MonthlyReportDraftsResult = { reportingMonth: string; clients: number; created: number; skipped: number; failed: number };

const CAP = 300; // 한 배치 상한(무한 루프·과부하 방지)

/** now 기준 "지난달"(YYYY-MM). 월초(1일)에 돌면 직전 달 보고서를 만든다. */
function previousMonth(now: Date): string {
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

export async function runMonthlyReportDrafts(now = new Date()): Promise<MonthlyReportDraftsResult> {
  const reportingMonth = previousMonth(now);
  const monthStart = new Date(`${reportingMonth}-01T00:00:00.000Z`);

  // 담당자가 배정된 거래처만(= 운영 중, 보고서 작성자도 담당 마케터로).
  const clients = await db.client
    .findMany({ where: { assignedMarketerId: { not: null } }, select: { id: true, name: true, assignedMarketerId: true } })
    .catch(() => []);

  const result: MonthlyReportDraftsResult = { reportingMonth, clients: clients.length, created: 0, skipped: 0, failed: 0 };

  let processed = 0;
  for (const c of clients) {
    if (processed >= CAP) {
      console.warn(`[monthly-report] cap ${CAP} 도달 — ${clients.length - processed}개 거래처 이번 배치 제외`);
      break;
    }
    processed++;
    try {
      const existing = await db.report.findUnique({
        where: { clientId_reportingMonth: { clientId: c.id, reportingMonth: monthStart } },
        select: { id: true }
      });
      if (existing) {
        result.skipped++;
        continue;
      }
      await buildMonthlyReportDraft({ clientId: c.id, clientName: c.name, reportingMonth, authorId: c.assignedMarketerId as string });
      result.created++;
    } catch (e) {
      console.error("[monthly-report] client failed", c.id, e);
      result.failed++; // 개별 실패 격리 — 나머지 계속
    }
  }

  if (result.created > 0) {
    await db.auditLog
      .create({ data: { actorId: null, action: "report.autoDraftBatch", targetType: "Report", targetId: "batch", afterState: { reportingMonth, created: result.created } } })
      .catch(() => {});
  }

  return result;
}
