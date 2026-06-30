"use server";

/**
 * 거래처(Client) 생성/수정 server action (V2 §2).
 *
 * §1 공통 인프라를 그대로 사용한다:
 * - 입력 검증: `clientFormSchema` (Zod) → 실패 시 VALIDATION_ERROR + fieldErrors
 * - 권한: `requireCurrentUser` / `requireRole` / `requireClientAccess`
 * - 응답 규약: `runAction` → `ActionResult`
 * - 감사 로그: `writeAuditLog` (best-effort)
 *
 * 권한 정책:
 * - 생성: 최고관리자(SUPER_ADMIN)
 * - 수정: 최고관리자 또는 해당 거래처 접근 권한이 있는 관리자(ADMIN)
 * - 담당자(MARKETER): 거래처 마스터 데이터 쓰기 불가(읽기 전용)
 */
import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import { clientFormSchema } from "@/domain/clients";
import { Role } from "@/domain/types";
import { runAction, type ActionResult } from "@/server/action-result";
import { requireClientAccess, requireCurrentUser, requireRole } from "@/server/authorization";
import { AuditAction, writeAuditLog } from "@/server/audit";
import { conflict, notFound } from "@/server/errors";
import {
  createClient,
  getClientAccessInfo,
  getClientDetail,
  updateClient
} from "@/server/repositories/clients";

export type ClientActionState = ActionResult<{ id: string }>;

function formDataToObject(formData: FormData) {
  const record: Record<string, string> = {};
  for (const [key, value] of formData.entries()) {
    if (typeof value === "string") {
      record[key] = value;
    }
  }
  return record;
}

/** Prisma unique 위반(P2002: 거래처 코드 중복)을 CONFLICT로 변환한다. */
function rethrowAsDomainError(error: unknown): never {
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
    throw conflict("이미 사용 중인 거래처 코드입니다.");
  }
  throw error;
}

export async function createClientAction(
  _prevState: ClientActionState | null,
  formData: FormData
): Promise<ClientActionState> {
  return runAction(async () => {
    const user = await requireCurrentUser();
    requireRole(user, [Role.SUPER_ADMIN]);

    const input = clientFormSchema.parse(formDataToObject(formData));

    const created = await createClient(input).catch(rethrowAsDomainError);

    await writeAuditLog({
      actorId: user.id,
      action: AuditAction.CLIENT_CREATED,
      targetType: "Client",
      targetId: created.id,
      afterState: input
    });

    revalidatePath("/clients");
    return created;
  });
}

export async function updateClientAction(
  _prevState: ClientActionState | null,
  formData: FormData
): Promise<ClientActionState> {
  return runAction(async () => {
    const user = await requireCurrentUser();
    requireRole(user, [Role.SUPER_ADMIN, Role.ADMIN]);

    const clientId = formDataToObject(formData).id ?? "";
    const existing = await getClientAccessInfo(clientId);

    if (!existing) {
      throw notFound("거래처를 찾을 수 없습니다.");
    }

    await requireClientAccess(user, clientId, { assignedMarketerId: existing.assignedMarketerId });

    const before = await getClientDetail(clientId);
    const input = clientFormSchema.parse(formDataToObject(formData));

    const updated = await updateClient(clientId, input).catch(rethrowAsDomainError);

    await writeAuditLog({
      actorId: user.id,
      action: AuditAction.CLIENT_UPDATED,
      targetType: "Client",
      targetId: updated.id,
      beforeState: before,
      afterState: input
    });

    revalidatePath("/clients");
    return updated;
  });
}
