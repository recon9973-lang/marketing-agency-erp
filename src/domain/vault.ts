import { z } from "zod";

/**
 * 보관함(공용 파일함) 입력 검증 (워크플로우 5차).
 *
 * 권한 정책은 server action에서 강제한다:
 * - 폴더 생성/삭제: 최고관리자(SUPER_ADMIN)만 가능
 * - 파일 업로드/삭제/이동: 로그인한 직원 누구나 가능
 */

/** 보관함 폴더 생성 입력 검증. */
export const createVaultFolderSchema = z.object({
  name: z
    .string({ required_error: "폴더 이름을 입력해주세요." })
    .trim()
    .min(1, "폴더 이름을 입력해주세요.")
    .max(50, "폴더 이름은 50자 이내로 입력해주세요.")
});

export type CreateVaultFolderInput = z.infer<typeof createVaultFolderSchema>;

/** 보관함 폴더 삭제 입력 검증. */
export const deleteVaultFolderSchema = z.object({
  folderId: z.string().trim().min(1, "삭제할 폴더를 확인해주세요.")
});

/** 보관함 파일 삭제 입력 검증. */
export const deleteVaultFileSchema = z.object({
  fileId: z.string().trim().min(1, "삭제할 파일을 확인해주세요.")
});

/** 보관함 파일 이동(폴더 변경) 입력 검증. folderId가 빈 값이면 미분류(루트)로 이동. */
export const moveVaultFileSchema = z.object({
  fileId: z.string().trim().min(1, "이동할 파일을 확인해주세요."),
  folderId: z
    .string()
    .trim()
    .optional()
    .transform((value) => (value ? value : null))
});
