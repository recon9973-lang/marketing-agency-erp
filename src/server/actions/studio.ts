"use server";

/**
 * 이미지 스튜디오 server action (워크플로우 6차).
 *
 * 스튜디오에서 만든 이미지를 공용 보관함(inVault)에 저장한다.
 * 저장은 로그인한 직원 누구나 가능하다.
 */
import { revalidatePath } from "next/cache";
import { saveStudioImageSchema } from "@/domain/studio";
import { runAction, type ActionResult } from "@/server/action-result";
import { requireCurrentUser } from "@/server/authorization";
import { validationError } from "@/server/errors";
import { MAX_FILE_SIZE } from "@/server/repositories/files";
import { createVaultFile, findVaultFolder } from "@/server/repositories/vault";

function formDataToObject(formData: FormData) {
  const record: Record<string, string> = {};
  for (const [key, value] of formData.entries()) {
    if (typeof value === "string") {
      record[key] = value;
    }
  }
  return record;
}

/** data URL(base64)을 mime과 바이트로 분해. */
function decodeDataUrl(dataUrl: string): { mimeType: string; data: Uint8Array } {
  const match = /^data:([^;]+);base64,(.*)$/.exec(dataUrl);
  if (!match) {
    throw validationError("이미지 데이터를 해석할 수 없습니다.");
  }
  const mimeType = match[1];
  const binary = Buffer.from(match[2], "base64");
  return { mimeType, data: new Uint8Array(binary) };
}

function extensionFor(mimeType: string) {
  if (mimeType === "image/jpeg") return "jpg";
  if (mimeType === "image/webp") return "webp";
  return "png";
}

export type SaveStudioImageState = ActionResult<{ id: string }>;

export async function saveStudioImageAction(
  _prevState: SaveStudioImageState | null,
  formData: FormData
): Promise<SaveStudioImageState> {
  return runAction(async () => {
    const user = await requireCurrentUser();
    const input = saveStudioImageSchema.parse(formDataToObject(formData));

    const { mimeType, data } = decodeDataUrl(input.dataUrl);

    if (data.byteLength > MAX_FILE_SIZE) {
      throw validationError("이미지가 4MB를 넘습니다. 크기를 줄여 다시 시도해주세요.");
    }

    let folderId = input.folderId;
    if (folderId) {
      const folder = await findVaultFolder(folderId);
      if (!folder) folderId = null;
    }

    // 파일명은 안전한 문자만 남기고 확장자를 붙인다.
    const base = input.fileName.replace(/[\\/:*?"<>|]+/g, " ").trim().slice(0, 100) || "제작물";
    const fileName = `${base}.${extensionFor(mimeType)}`;

    const stored = await createVaultFile({
      fileName,
      mimeType,
      data,
      uploadedById: user.id,
      folderId
    });

    revalidatePath("/vault");
    return { id: stored.id };
  });
}
