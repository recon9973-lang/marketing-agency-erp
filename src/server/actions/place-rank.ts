"use server";

/**
 * 거래처 플레이스 순위 기록/삭제 server action (V2 §7).
 *
 * 권한 정책:
 * - 기록/삭제: 해당 거래처에 접근 가능한 직원
 *   (배정 담당자, scope에 포함된 관리자, 최고관리자)
 * - 같은 거래처·키워드·날짜 조합은 upsert로 덮어쓴다(하루 1건).
 */
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { placeRankFormSchema } from "@/domain/place-rank";
import { runAction, type ActionResult } from "@/server/action-result";
import { requireClientAccess, requireCurrentUser } from "@/server/authorization";
import { AuditAction, writeAuditLog } from "@/server/audit";
import { notFound } from "@/server/errors";
import { getClientAccessInfo } from "@/server/repositories/clients";
import {
  deletePlaceRank,
  getPlaceRankAccessInfo,
  upsertPlaceRank
} from "@/server/repositories/place-rank";

export type PlaceRankActionState = ActionResult<{ id: string }>;

function formDataToObject(formData: FormData) {
  const record: Record<string, string> = {};
  for (const [key, value] of formData.entries()) {
    if (typeof value === "string") {
      record[key] = value;
    }
  }
  return record;
}

async function requireAccessToClient(user: Awaited<ReturnType<typeof requireCurrentUser>>, clientId: string) {
  const client = await getClientAccessInfo(clientId);

  if (!client) {
    throw notFound("거래처를 찾을 수 없습니다.");
  }

  await requireClientAccess(user, clientId, { assignedMarketerId: client.assignedMarketerId });
}

export async function recordPlaceRankAction(
  _prevState: PlaceRankActionState | null,
  formData: FormData
): Promise<PlaceRankActionState> {
  return runAction(async () => {
    const user = await requireCurrentUser();
    const input = placeRankFormSchema.parse(formDataToObject(formData));

    await requireAccessToClient(user, input.clientId);

    const recordedOn = new Date(`${input.recordedOn}T00:00:00.000Z`);
    const saved = await upsertPlaceRank(
      {
        clientId: input.clientId,
        keyword: input.keyword,
        rank: input.rank,
        recordedOn,
        memo: input.memo ?? null
      },
      user.id
    );

    await writeAuditLog({
      actorId: user.id,
      action: AuditAction.PLACE_RANK_RECORDED,
      targetType: "PlaceRankRecord",
      targetId: saved.id,
      afterState: {
        clientId: input.clientId,
        keyword: input.keyword,
        rank: input.rank,
        recordedOn: input.recordedOn
      }
    });

    revalidatePath(`/clients/${input.clientId}/ranks`);
    return { id: saved.id };
  });
}

const deleteSchema = z.object({
  id: z.string().trim().min(1)
});

export async function deletePlaceRankAction(
  _prevState: PlaceRankActionState | null,
  formData: FormData
): Promise<PlaceRankActionState> {
  return runAction(async () => {
    const user = await requireCurrentUser();
    const { id } = deleteSchema.parse(formDataToObject(formData));

    const existing = await getPlaceRankAccessInfo(id);

    if (!existing) {
      throw notFound("순위 기록을 찾을 수 없습니다.");
    }

    await requireAccessToClient(user, existing.clientId);

    await deletePlaceRank(id);

    await writeAuditLog({
      actorId: user.id,
      action: AuditAction.PLACE_RANK_DELETED,
      targetType: "PlaceRankRecord",
      targetId: id,
      beforeState: {
        clientId: existing.clientId,
        keyword: existing.keyword,
        rank: existing.rank,
        recordedOn: existing.recordedOn.toISOString().slice(0, 10)
      }
    });

    revalidatePath(`/clients/${existing.clientId}/ranks`);
    return { id };
  });
}
