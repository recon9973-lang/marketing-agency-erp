import { z } from "zod";

/** 채팅 메시지 전송 입력 검증. */
export const chatMessageSchema = z.object({
  roomId: z.string().trim().min(1, "대화방을 확인해주세요."),
  // 파일만 첨부하는 메시지는 본문이 비어 있을 수 있다. (본문/파일 중 하나는 액션에서 강제)
  body: z
    .string()
    .trim()
    .max(2000, "메시지는 2000자 이내로 입력해주세요.")
    .optional()
    .transform((value) => value ?? "")
});

export type ChatMessageInput = z.infer<typeof chatMessageSchema>;

/** 1:1 대화 시작 입력 검증. */
export const startDirectChatSchema = z.object({
  userId: z.string().trim().min(1, "대화 상대를 선택해주세요.")
});

/** 협업방(그룹) 생성 입력 검증. */
export const createGroupRoomSchema = z.object({
  name: z
    .string({ required_error: "협업방 이름을 입력해주세요." })
    .trim()
    .min(1, "협업방 이름을 입력해주세요.")
    .max(60, "협업방 이름은 60자 이내로 입력해주세요."),
  memberIds: z.array(z.string().trim().min(1)).min(1, "멤버를 1명 이상 선택해주세요."),
  clientId: z
    .string()
    .trim()
    .optional()
    .transform((value) => (value ? value : undefined))
});

export type CreateGroupRoomInput = z.infer<typeof createGroupRoomSchema>;
