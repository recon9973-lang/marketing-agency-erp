// 목표 경로: src/server/repositories/approvals.ts
//
// 승인 조회 — 대기 목록(승인자용) + 내 요청.
import { db } from "@/server/db";

export type ApprovalView = {
  id: string;
  targetType: string;
  targetId: string;
  title: string;
  clientName: string | null;
  requesterName: string;
  approverName: string | null;
  status: string;
  comment: string | null;
  createdAt: string;
  decidedAt: string | null;
};

const TYPE_LABEL: Record<string, string> = { CONTRACT: "계약", QUOTE: "견적", CONTENT: "콘텐츠", COMPLIANCE: "컴플라이언스" };
export function approvalTypeLabel(t: string) {
  return TYPE_LABEL[t] ?? t;
}

function map(rows: Awaited<ReturnType<typeof fetchRows>>): ApprovalView[] {
  return rows.map((a) => ({
    id: a.id,
    targetType: a.targetType,
    targetId: a.targetId,
    title: a.title,
    clientName: a.client?.name ?? null,
    requesterName: a.requester.name,
    approverName: a.approver?.name ?? null,
    status: a.status,
    comment: a.comment,
    createdAt: a.createdAt.toISOString(),
    decidedAt: a.decidedAt ? a.decidedAt.toISOString() : null
  }));
}

async function fetchRows(where: object) {
  return db.approval.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: 100,
    include: { requester: { select: { name: true } }, approver: { select: { name: true } }, client: { select: { name: true } } }
  });
}

/** 대기 중 승인(승인자=관리자용). */
export async function listPendingApprovals(): Promise<ApprovalView[]> {
  return map(await fetchRows({ status: "PENDING" }));
}

/** 내가 요청한 승인(모든 상태). */
export async function listMyApprovalRequests(userId: string): Promise<ApprovalView[]> {
  return map(await fetchRows({ requesterId: userId }));
}
