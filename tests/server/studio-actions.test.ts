import { beforeEach, describe, expect, it, vi } from "vitest";
import { ErrorCode } from "@/server/errors";
import { marketerUser } from "../helpers/users";
import { expectFail, expectOk } from "../helpers/action-result";

const getCurrentUserMock = vi.fn();
const createVaultFileMock = vi.fn();
const findVaultFolderMock = vi.fn();
const revalidatePathMock = vi.fn();

vi.mock("@/server/session", () => ({ getCurrentUser: getCurrentUserMock }));
vi.mock("@/server/repositories/vault", () => ({
  createVaultFile: createVaultFileMock,
  findVaultFolder: findVaultFolderMock
}));
vi.mock("next/cache", () => ({ revalidatePath: revalidatePathMock }));

async function loadActions() {
  return import("@/server/actions/studio");
}

// 2x1 투명 PNG data URL(작은 유효 이미지).
const PNG_DATA_URL =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";

function formData(entries: Record<string, string>) {
  const fd = new FormData();
  for (const [key, value] of Object.entries(entries)) fd.set(key, value);
  return fd;
}

beforeEach(() => {
  vi.clearAllMocks();
  getCurrentUserMock.mockResolvedValue(marketerUser({ id: "marketer-1" }));
});

describe("saveStudioImageAction", () => {
  it("stores a rendered image into the vault with a safe filename", async () => {
    const { saveStudioImageAction } = await loadActions();
    createVaultFileMock.mockResolvedValue({ id: "file-1" });

    const result = await saveStudioImageAction(
      null,
      formData({ dataUrl: PNG_DATA_URL, fileName: "8.15 휴진 / 서울치과" })
    );

    expect(expectOk(result)).toEqual({ id: "file-1" });
    const arg = createVaultFileMock.mock.calls[0][0];
    expect(arg.mimeType).toBe("image/png");
    expect(arg.uploadedById).toBe("marketer-1");
    expect(arg.fileName).toBe("8.15 휴진   서울치과.png"); // 슬래시 등 위험문자 제거
    expect(arg.data.byteLength).toBeGreaterThan(0);
  });

  it("rejects a non-image data URL", async () => {
    const { saveStudioImageAction } = await loadActions();

    expectFail(
      await saveStudioImageAction(null, formData({ dataUrl: "data:text/plain;base64,aGk=" })),
      ErrorCode.VALIDATION_ERROR
    );
    expect(createVaultFileMock).not.toHaveBeenCalled();
  });

  it("falls back to root when the target folder is gone", async () => {
    const { saveStudioImageAction } = await loadActions();
    findVaultFolderMock.mockResolvedValue(null);
    createVaultFileMock.mockResolvedValue({ id: "file-2" });

    await saveStudioImageAction(null, formData({ dataUrl: PNG_DATA_URL, folderId: "gone" }));

    expect(createVaultFileMock.mock.calls[0][0].folderId).toBeNull();
  });
});
