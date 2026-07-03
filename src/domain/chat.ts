import { z } from "zod";

/** 채팅 메시지 전송 입력 검증. */
export const chatMessageSchema = z.object({
  roomId: z.string().trim().min(1, "대화방을 확인해주세요."),
  body: z
    .string({ required_error: "메시지를 입력해주세요." })
    .trim()
    .min(1, "메시지를 입력해주세요.")
    .max(2000, "메시지는 2000자 이내로 입력해주세요.")
});

export type ChatMessageInput = z.infer<typeof chatMessageSchema>;

/** 1:1 대화 시작 입력 검증. */
export const startDirectChatSchema = z.object({
  userId: z.string().trim().min(1, "대화 상대를 선택해주세요.")
});
