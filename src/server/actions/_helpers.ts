// 목표 경로: src/server/actions/_helpers.ts
//
// 모든 쓰기 server action이 공유하는 공통 인프라.
// - requireUser(): 인증 actor 확보 (없으면 throw)
// - getAdminScopes(): ADMIN의 AccessScope 로드 (SUPER_ADMIN/MARKETER는 빈 배열)
// - recordAudit(): AuditLog 실제 저장 (before/after 스냅샷)
// - runAction(): 표준 try/catch → ActionResult 변환 (에러코드를 사용자 메시지로)
// - requestMeta(): ip/userAgent 추출 (감사 메타)
//
// 주의: 이 파일은 "use server" 모듈이 아니다(일반 서버 유틸). 이유:
//  (1) runAction()은 함수를 인자로 받는데, server action 인자는 직렬화 가능해야 하므로
//      "use server"로 노출하면 안 된다. (2) toAuditState()는 동기 함수인데
//      "use server" 파일은 async export만 허용한다. 실제 server action 진입점은
//      이 파일을 import해 쓰는 actions/*.ts들이며, 각자 "use server"를 갖는다.
import { Prisma } from "@prisma/client";
import { headers } from "next/headers";

import { Role } from "@/domain/types";
import type { AccessScopeRecord } from "@/domain/access-control";
import { db } from "@/server/db";
import { getCurrentUser, type CurrentUser } from "@/server/session";

export type ActionResult<T = void> =
  | { ok: true; data?: T }
  | { ok: false; error: string; code?: string };

/** 인증된 직원 actor를 반환. 없으면 throw (runAction이 잡아 UNAUTHENTICATED로 변환). */
export async function requireUser(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) {
    throw new Error("UNAUTHENTICATED");
  }
  return user;
}

/** ADMIN의 접근 범위를 로드. SUPER_ADMIN/MARKETER는 scope가 필요없어 빈 배열. */
export async function getAdminScopes(user: CurrentUser): Promise<AccessScopeRecord[]> {
  if (user.role !== Role.ADMIN) {
    return [];
  }
  const rows = await db.accessScope.findMany({
    where: { adminId: user.id },
    select: {
      adminId: true,
      marketerId: true,
      clientId: true,
      allMarketers: true,
      allClients: true
    }
  });
  return rows;
}

/** Decimal/Date 등 Prisma 값을 AuditLog Json 컬럼에 안전하게 직렬화. */
export function toAuditState(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(
    JSON.stringify(value, (_key, v) => (typeof v === "bigint" ? v.toString() : v))
  ) as Prisma.InputJsonValue;
}

export type AuditEntry = {
  actorId: string | null;
  action: string;
  targetType: string;
  targetId: string;
  beforeState?: unknown;
  afterState?: unknown;
  ipAddress?: string | null;
  userAgent?: string | null;
};

/** 트랜잭션 내에서 AuditLog 1건 저장. 본 변경과 같은 tx로 묶어 정합성 보장. */
export async function recordAudit(
  tx: Prisma.TransactionClient,
  entry: AuditEntry
): Promise<void> {
  await tx.auditLog.create({
    data: {
      actorId: entry.actorId,
      action: entry.action,
      targetType: entry.targetType,
      targetId: entry.targetId,
      beforeState: entry.beforeState === undefined ? undefined : toAuditState(entry.beforeState),
      afterState: entry.afterState === undefined ? undefined : toAuditState(entry.afterState),
      ipAddress: entry.ipAddress ?? null,
      userAgent: entry.userAgent ?? null
    }
  });
}

/** 감사 메타(ip, userAgent) 추출. 실패해도 액션을 막지 않음. */
export async function requestMeta(): Promise<{ ipAddress: string | null; userAgent: string | null }> {
  try {
    const h = await headers();
    const ipAddress =
      h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? h.get("x-real-ip") ?? null;
    const userAgent = h.get("user-agent") ?? null;
    return { ipAddress, userAgent };
  } catch {
    return { ipAddress: null, userAgent: null };
  }
}

const ERROR_MESSAGES: Record<string, string> = {
  UNAUTHENTICATED: "로그인이 필요합니다.",
  FORBIDDEN_CLIENT_ACCESS: "이 거래처에 접근할 권한이 없습니다.",
  FORBIDDEN: "권한이 없습니다.",
  ILLEGAL_TRANSITION: "허용되지 않은 상태 변경입니다.",
  DUPLICATE_CLIENT_CODE: "이미 사용 중인 거래처 코드입니다.",
  NOT_FOUND: "대상을 찾을 수 없습니다.",
  VALIDATION: "입력값을 확인해주세요.",
  INACTIVE_MARKETER: "비활성 담당자에게는 배정할 수 없습니다.",
  AI_NOT_CONFIGURED: "AI가 아직 연결되지 않았습니다. 연동 화면에서 ANTHROPIC_API_KEY를 등록하면 켜집니다.",
  AI_EMPTY: "AI가 결과를 만들지 못했습니다. 주제를 조금 더 구체적으로 입력해 다시 시도해주세요.",
  CONSENT_REQUIRED: "연락처를 수집하려면 개인정보 수집 동의가 필요합니다.",
  ALREADY_CONVERTED: "이미 거래처로 전환된 리드입니다.",
  CLIENT_CODE_CONFLICT: "거래처 코드 생성이 반복 충돌했습니다. 다시 시도해주세요.",
  EVIDENCE_REQUIRED: "완료 처리에는 결과 요약(산출물 링크·적용 URL 등 증빙)이 필요합니다.",
  COMPLIANCE_BLOCKED: "위험 표현이 해소되지 않아 진행할 수 없습니다. 검수 후 다시 시도해주세요.",
  CLIENT_APPROVAL_REQUIRED: "병원(거래처) 승인 전에는 게시할 수 없습니다."
};

/** 표준 액션 래퍼: 에러를 사용자 친화 메시지로 변환해 ActionResult로 반환. */
export async function runAction<T>(fn: () => Promise<T>): Promise<ActionResult<T>> {
  try {
    const data = await fn();
    return { ok: true, data };
  } catch (err) {
    const raw = err instanceof Error ? err.message : "UNKNOWN";
    const code = raw in ERROR_MESSAGES ? raw : "UNKNOWN";
    if (code === "UNKNOWN") {
      // 원인 진단용: 예상 밖 오류는 서버 로그에 전체를 남기고,
      // 사용자에겐 Prisma 에러코드(P2xxx)만 덧붙인다(민감정보 미노출).
      console.error("[runAction] unexpected error:", err);
      const prismaCode = (err as { code?: string })?.code;
      return {
        ok: false,
        code,
        error: `처리 중 오류가 발생했습니다.${prismaCode ? ` (${prismaCode})` : ""}`
      };
    }
    return {
      ok: false,
      code,
      error: ERROR_MESSAGES[code] ?? "처리 중 오류가 발생했습니다."
    };
  }
}
