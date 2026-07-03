import { beforeEach, describe, expect, it, vi } from "vitest";
import { ErrorCode } from "@/server/errors";
import { marketerUser, superAdminUser } from "../helpers/users";
import { expectFail, expectOk } from "../helpers/action-result";

const getCurrentUserMock = vi.fn();
const createVaultFolderMock = vi.fn();
const deleteVaultFolderMock = vi.fn();
const findVaultFolderMock = vi.fn();
const createVaultFileMock = vi.fn();
const deleteVaultFileMock = vi.fn();
const moveVaultFileMock = vi.fn();
const revalidatePathMock = vi.fn();

vi.mock("@/server/session", () => ({ getCurrentUser: getCurrentUserMock }));
vi.mock("@/server/repositories/vault", () => ({
  createVaultFolder: createVaultFolderMock,
  deleteVaultFolder: deleteVaultFolderMock,
  findVaultFolder: findVaultFolderMock,
  createVaultFile: createVaultFileMock,
  deleteVaultFile: deleteVaultFileMock,
  moveVaultFile: moveVaultFileMock
}));
vi.mock("next/cache", () => ({ revalidatePath: revalidatePathMock }));

async function loadActions() {
  return import("@/server/actions/vault");
}

function formData(entries: Record<string, string>) {
  const fd = new FormData();
  for (const [key, value] of Object.entries(entries)) {
    fd.set(key, value);
  }
  return fd;
}

beforeEach(() => {
  vi.clearAllMocks();
  getCurrentUserMock.mockResolvedValue(superAdminUser({ id: "super-1" }));
});

describe("createVaultFolderAction", () => {
  it("lets a super admin create a folder", async () => {
    const { createVaultFolderAction } = await loadActions();
    createVaultFolderMock.mockResolvedValue({ id: "folder-1" });

    const result = await createVaultFolderAction(null, formData({ name: "8월 소재" }));

    expect(expectOk(result)).toEqual({ folderId: "folder-1" });
    expect(createVaultFolderMock).toHaveBeenCalledWith("8월 소재", "super-1");
  });

  it("blocks non-super-admins", async () => {
    const { createVaultFolderAction } = await loadActions();
    getCurrentUserMock.mockResolvedValue(marketerUser({ id: "marketer-1" }));

    expectFail(await createVaultFolderAction(null, formData({ name: "몰래 폴더" })), ErrorCode.FORBIDDEN);
    expect(createVaultFolderMock).not.toHaveBeenCalled();
  });

  it("requires a folder name", async () => {
    const { createVaultFolderAction } = await loadActions();

    const error = expectFail(await createVaultFolderAction(null, formData({ name: "  " })), ErrorCode.VALIDATION_ERROR);
    expect(error.fieldErrors?.name).toBeDefined();
    expect(createVaultFolderMock).not.toHaveBeenCalled();
  });
});

describe("deleteVaultFolderAction", () => {
  it("lets a super admin delete an existing folder", async () => {
    const { deleteVaultFolderAction } = await loadActions();
    findVaultFolderMock.mockResolvedValue({ id: "folder-1" });

    const result = await deleteVaultFolderAction(null, formData({ folderId: "folder-1" }));

    expect(expectOk(result)).toEqual({ ok: true });
    expect(deleteVaultFolderMock).toHaveBeenCalledWith("folder-1");
  });

  it("blocks non-super-admins", async () => {
    const { deleteVaultFolderAction } = await loadActions();
    getCurrentUserMock.mockResolvedValue(marketerUser({ id: "marketer-1" }));

    expectFail(await deleteVaultFolderAction(null, formData({ folderId: "folder-1" })), ErrorCode.FORBIDDEN);
    expect(deleteVaultFolderMock).not.toHaveBeenCalled();
  });

  it("returns NOT_FOUND for a missing folder", async () => {
    const { deleteVaultFolderAction } = await loadActions();
    findVaultFolderMock.mockResolvedValue(null);

    expectFail(await deleteVaultFolderAction(null, formData({ folderId: "ghost" })), ErrorCode.NOT_FOUND);
    expect(deleteVaultFolderMock).not.toHaveBeenCalled();
  });
});

describe("uploadVaultFileAction", () => {
  it("stores an uploaded file under the chosen folder", async () => {
    const { uploadVaultFileAction } = await loadActions();
    getCurrentUserMock.mockResolvedValue(marketerUser({ id: "marketer-1" }));
    findVaultFolderMock.mockResolvedValue({ id: "folder-1" });
    createVaultFileMock.mockResolvedValue({ id: "file-1" });

    const fd = formData({ folderId: "folder-1" });
    fd.set("file", new File([new Uint8Array([1, 2, 3])], "brief.pdf", { type: "application/pdf" }));

    const result = await uploadVaultFileAction(null, fd);

    expect(expectOk(result)).toEqual({ id: "file-1" });
    expect(createVaultFileMock).toHaveBeenCalledWith(
      expect.objectContaining({ fileName: "brief.pdf", uploadedById: "marketer-1", folderId: "folder-1" })
    );
  });

  it("falls back to root when the folder no longer exists", async () => {
    const { uploadVaultFileAction } = await loadActions();
    findVaultFolderMock.mockResolvedValue(null);
    createVaultFileMock.mockResolvedValue({ id: "file-2" });

    const fd = formData({ folderId: "gone" });
    fd.set("file", new File([new Uint8Array([1])], "note.txt", { type: "text/plain" }));

    await uploadVaultFileAction(null, fd);

    expect(createVaultFileMock).toHaveBeenCalledWith(expect.objectContaining({ folderId: null }));
  });

  it("requires an actual file", async () => {
    const { uploadVaultFileAction } = await loadActions();

    const error = expectFail(await uploadVaultFileAction(null, formData({ folderId: "" })), ErrorCode.VALIDATION_ERROR);
    expect(error.fieldErrors?.file).toBeDefined();
    expect(createVaultFileMock).not.toHaveBeenCalled();
  });

  it("rejects files over the size limit", async () => {
    const { uploadVaultFileAction } = await loadActions();

    const fd = formData({ folderId: "" });
    fd.set("file", new File([new Uint8Array(4 * 1024 * 1024 + 1)], "big.bin", { type: "application/octet-stream" }));

    const error = expectFail(await uploadVaultFileAction(null, fd), ErrorCode.VALIDATION_ERROR);
    expect(error.fieldErrors?.file).toBeDefined();
    expect(createVaultFileMock).not.toHaveBeenCalled();
  });
});

describe("deleteVaultFileAction", () => {
  it("lets any staff member delete a vault file", async () => {
    const { deleteVaultFileAction } = await loadActions();
    getCurrentUserMock.mockResolvedValue(marketerUser({ id: "marketer-1" }));
    deleteVaultFileMock.mockResolvedValue(1);

    const result = await deleteVaultFileAction(null, formData({ fileId: "file-1" }));

    expect(expectOk(result)).toEqual({ ok: true });
    expect(deleteVaultFileMock).toHaveBeenCalledWith("file-1");
  });

  it("returns NOT_FOUND when nothing was deleted", async () => {
    const { deleteVaultFileAction } = await loadActions();
    deleteVaultFileMock.mockResolvedValue(0);

    expectFail(await deleteVaultFileAction(null, formData({ fileId: "ghost" })), ErrorCode.NOT_FOUND);
  });
});

describe("moveVaultFileAction", () => {
  it("moves a file to another folder", async () => {
    const { moveVaultFileAction } = await loadActions();
    getCurrentUserMock.mockResolvedValue(marketerUser({ id: "marketer-1" }));
    findVaultFolderMock.mockResolvedValue({ id: "folder-2" });
    moveVaultFileMock.mockResolvedValue(1);

    const result = await moveVaultFileAction(null, formData({ fileId: "file-1", folderId: "folder-2" }));

    expect(expectOk(result)).toEqual({ ok: true });
    expect(moveVaultFileMock).toHaveBeenCalledWith("file-1", "folder-2");
  });

  it("moves a file to root when folderId is blank", async () => {
    const { moveVaultFileAction } = await loadActions();
    moveVaultFileMock.mockResolvedValue(1);

    await moveVaultFileAction(null, formData({ fileId: "file-1", folderId: "" }));

    expect(moveVaultFileMock).toHaveBeenCalledWith("file-1", null);
    expect(findVaultFolderMock).not.toHaveBeenCalled();
  });
});
