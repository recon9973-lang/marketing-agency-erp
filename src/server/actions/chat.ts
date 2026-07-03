"use server";

/**
 * 내부 채팅 server action (워크플로우 2차).
 *
 * 정책:
 * - 대화 시작: 활성 직원 누구와도 1:1 대화 가능. 기존 방이 있으면 재사용.
 * - 전송: 방 멤버만 가능.
 * - 조회 편의 기능이므로 감사 로그는 남기지 않는다.
 */
import { revalidatePath } from "next/cache";
import { chatMessageSchema, startDirectChatSchema } from "@/domain/chat";
import { runAction, type ActionResult } from "@/server/action-result";
import { requireCurrentUser } from "@/server/authorization";
import { notFound, validationError } from "@/server/errors";
import {
  createDirectRoom,
  createMessage,
  findDirectRoom,
  getActiveUser,
  getRoomForUser
} from "@/server/repositories/chat";

function formDataToObject(formData: FormData) {
  const record: Record<string, string> = {};
  for (const [key, value] of formData.entries()) {
    if (typeof value === "string") {
      record[key] = value;
    }
  }
  return record;
}

export type StartChatActionState = ActionResult<{ roomId: string }>;

export async function startDirectChatAction(
  _prevState: StartChatActionState | null,
  formData: FormData
): Promise<StartChatActionState> {
  return runAction(async () => {
    const user = await requireCurrentUser();
    const { userId } = startDirectChatSchema.parse(formDataToObject(formData));

    if (userId === user.id) {
      throw validationError("본인과는 대화를 시작할 수 없습니다.");
    }

    const partner = await getActiveUser(userId);

    if (!partner) {
      throw notFound("대화 상대를 찾을 수 없습니다.");
    }

    const existingRoomId = await findDirectRoom(user.id, userId);
    const roomId = existingRoomId ?? (await createDirectRoom(user.id, userId));

    revalidatePath("/messages");
    return { roomId };
  });
}

export type SendMessageActionState = ActionResult<{ id: string }>;

export async function sendChatMessageAction(
  _prevState: SendMessageActionState | null,
  formData: FormData
): Promise<SendMessageActionState> {
  return runAction(async () => {
    const user = await requireCurrentUser();
    const input = chatMessageSchema.parse(formDataToObject(formData));

    const room = await getRoomForUser(input.roomId, user.id);

    if (!room) {
      throw notFound("대화방을 찾을 수 없습니다.");
    }

    const message = await createMessage(input.roomId, user.id, input.body);

    revalidatePath(`/messages/${input.roomId}`);
    return { id: message.id };
  });
}
