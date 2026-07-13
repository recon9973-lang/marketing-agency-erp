// src/server/compliance/log.ts
//
// 컴플라이언스 검수 결과를 ComplianceLog(정규화 테이블, §4)에 적재하는 헬퍼.
// 트랜잭션 클라이언트(tx) 또는 db를 받아 한 행으로 기록한다(법적 방어용 단일 추출).

import type { Prisma } from "@prisma/client";

type ComplianceLogInput = {
  clientId?: string | null;
  targetType: string; // ContentPlan | ConsultingReport | Report | MagazinePost
  targetId: string;
  highCount: number;
  mediumCount: number;
  flags?: unknown;
  reviewerId?: string | null;
  orgId?: string | null;
};

// 트랜잭션(tx) 또는 db 모두 허용. 최소 필요한 create 시그니처만 요구.
type ComplianceLogClient = Pick<Prisma.TransactionClient, "complianceLog">;

/** highCount>0 → BLOCK, mediumCount>0 → WARN, else PASS. */
export function complianceVerdict(highCount: number, mediumCount: number): "BLOCK" | "WARN" | "PASS" {
  return highCount > 0 ? "BLOCK" : mediumCount > 0 ? "WARN" : "PASS";
}

export async function recordComplianceLog(tx: ComplianceLogClient, input: ComplianceLogInput): Promise<void> {
  await tx.complianceLog.create({
    data: {
      clientId: input.clientId ?? null,
      targetType: input.targetType,
      targetId: input.targetId,
      verdict: complianceVerdict(input.highCount, input.mediumCount),
      highCount: input.highCount,
      mediumCount: input.mediumCount,
      flags: (input.flags as object | null) ?? undefined,
      reviewerId: input.reviewerId ?? null,
      orgId: input.orgId ?? null
    }
  });
}
