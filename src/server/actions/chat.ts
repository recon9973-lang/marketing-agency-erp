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
import { chatMessageSchema, createGroupRoomSchema, startDirectChatSchema } from "@/domain/chat";
import { runAction, type ActionResult } from "@/server/action-result";
import { requireClientAccess, requireCurrentUser } from "@/server/authorization";
import { notFound, validationError } from "@/server/errors";
import {
  createDirectRoom,
  createGroupRoom,
  createMessage,
  findDirectRoom,
  getActiveUser,
  getActiveUserIds,
  getRoomForUser
} from "@/server/repositories/chat";
import { getClientAccessInfo } from "@/server/repositories/clients";
import { createStoredFile, MAX_FILE_SIZE } from "@/server/repositories/files";

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

    // 런타임에 따라 File 전역 클래스 구현이 달라 instanceof가 어긋날 수 있어 덕 타이핑으로 판별한다.
    const upload = formData.get("file") as File | string | null;
    const hasFile =
      typeof upload === "object" &&
      upload !== null &&
      typeof upload.arrayBuffer === "function" &&
      upload.size > 0;

    if (!input.body && !hasFile) {
      throw validationError("메시지 또는 파일을 입력해주세요.", {
        body: ["메시지 또는 파일을 입력해주세요."]
      });
    }

    let fileId: string | undefined;

    if (hasFile) {
      if (upload.size > MAX_FILE_SIZE) {
        throw validationError("파일은 4MB 이하만 첨부할 수 있습니다.", {
          file: ["파일은 4MB 이하만 첨부할 수 있습니다."]
        });
      }

      const stored = await createStoredFile({
        fileName: upload.name || "첨부파일",
        mimeType: upload.type || "application/octet-stream",
        data: new Uint8Array(await upload.arrayBuffer()),
        uploadedById: user.id
      });
      fileId = stored.id;
    }

    const message = await createMessage(input.roomId, user.id, input.body, fileId);

    revalidatePath(`/messages/${input.roomId}`);
    return { id: message.id };
  });
}

export async function createGroupRoomAction(
  _prevState: StartChatActionState | null,
  formData: FormData
): Promise<StartChatActionState> {
  return runAction(async () => {
    const user = await requireCurrentUser();
    const input = createGroupRoomSchema.parse({
      name: formData.get("name"),
      clientId: formData.get("clientId") ?? undefined,
      memberIds: formData.getAll("memberIds").filter((value) => typeof value === "string")
    });

    const activeIds = await getActiveUserIds(input.memberIds);

    if (activeIds.length === 0) {
      throw validationError("멤버를 1명 이상 선택해주세요.", {
        memberIds: ["활성 상태의 직원을 선택해주세요."]
      });
    }

    if (input.clientId) {
      const client = await getClientAccessInfo(input.clientId);

      if (!client) {
        throw notFound("연결할 거래처를 찾을 수 없습니다.");
      }

      await requireClientAccess(user, input.clientId, { assignedMarketerId: client.assignedMarketerId });
    }

    const roomId = await createGroupRoom(user.id, input.name, activeIds, input.clientId);

    revalidatePath("/messages");
    return { roomId };
  });
}
