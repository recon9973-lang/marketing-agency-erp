import { z } from "zod";

/**
 * 이미지 스튜디오 → 보관함 저장 입력 검증 (워크플로우 6차).
 *
 * 스튜디오에서 만든 이미지를 PNG(base64 data URL)로 받아 공용 보관함에 저장한다.
 */
export const saveStudioImageSchema = z.object({
  // "data:image/png;base64,...." 형태
  dataUrl: z
    .string()
    .trim()
    .regex(/^data:image\/(png|jpeg|webp);base64,/, "이미지 데이터 형식이 올바르지 않습니다."),
  fileName: z
    .string()
    .trim()
    .min(1)
    .max(120)
    .optional()
    .transform((value) => value || "제작물"),
  folderId: z
    .string()
    .trim()
    .optional()
    .transform((value) => (value ? value : null))
});
