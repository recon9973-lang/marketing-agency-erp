"use server";

/**
 * 거래처 즐겨찾기 토글 server action.
 *
 * 정책: 본인 계정 기준으로만 토글되며, 접근 가능한 거래처만 즐겨찾기할 수 있다.
 * 조회 편의 기능이므로 감사 로그는 남기지 않는다.
 */
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { runAction, type ActionResult } from "@/server/action-result";
import { requireClientAccess, requireCurrentUser } from "@/server/authorization";
import { notFound } from "@/server/errors";
import { getClientAccessInfo } from "@/server/repositories/clients";
import { toggleFavoriteClient } from "@/server/repositories/favorites";

export type FavoriteActionState = ActionResult<{ clientId: string; favored: boolean }>;

const toggleSchema = z.object({
  clientId: z.string().trim().min(1)
});

export async function toggleClientFavoriteAction(
  _prevState: FavoriteActionState | null,
  formData: FormData
): Promise<FavoriteActionState> {
  return runAction(async () => {
    const user = await requireCurrentUser();
    const { clientId } = toggleSchema.parse({ clientId: formData.get("clientId") });

    const client = await getClientAccessInfo(clientId);

    if (!client) {
      throw notFound("거래처를 찾을 수 없습니다.");
    }

    await requireClientAccess(user, clientId, { assignedMarketerId: client.assignedMarketerId });

    const favored = await toggleFavoriteClient(user.id, clientId);

    revalidatePath("/clients");
    return { clientId, favored };
  });
}
