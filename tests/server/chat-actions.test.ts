import { beforeEach, describe, expect, it, vi } from "vitest";
import { ErrorCode } from "@/server/errors";
import { marketerUser } from "../helpers/users";
import { expectFail, expectOk } from "../helpers/action-result";

const getCurrentUserMock = vi.fn();
const getRoomForUserMock = vi.fn();
const createMessageMock = vi.fn();
const findDirectRoomMock = vi.fn();
const createDirectRoomMock = vi.fn();
const getActiveUserMock = vi.fn();
const getActiveUserIdsMock = vi.fn();
const createGroupRoomMock = vi.fn();
const getClientAccessInfoMock = vi.fn();
const loadAccessScopesMock = vi.fn();
const createStoredFileMock = vi.fn();
const revalidatePathMock = vi.fn();

vi.mock("@/server/session", () => ({ getCurrentUser: getCurrentUserMock }));
vi.mock("@/server/repositories/chat", () => ({
  getRoomForUser: getRoomForUserMock,
  createMessage: createMessageMock,
  findDirectRoom: findDirectRoomMock,
  createDirectRoom: createDirectRoomMock,
  getActiveUser: getActiveUserMock,
  getActiveUserIds: getActiveUserIdsMock,
  createGroupRoom: createGroupRoomMock
}));
vi.mock("@/server/repositories/clients", () => ({ getClientAccessInfo: getClientAccessInfoMock }));
vi.mock("@/server/scope", () => ({ loadAccessScopes: loadAccessScopesMock }));
vi.mock("@/server/repositories/files", async () => {
  const actual = await vi.importActual<typeof import("@/server/repositories/files")>(
    "@/server/repositories/files"
  );
  return { ...actual, createStoredFile: createStoredFileMock };
});
vi.mock("next/cache", () => ({ revalidatePath: revalidatePathMock }));

async function loadActions() {
  return import("@/server/actions/chat");
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
  getCurrentUserMock.mockResolvedValue(marketerUser({ id: "marketer-1" }));
  loadAccessScopesMock.mockResolvedValue([]);
});

describe("startDirectChatAction", () => {
  it("reuses an existing direct room", async () => {
    const { startDirectChatAction } = await loadActions();
    getActiveUserMock.mockResolvedValue({ id: "admin-1", name: "Admin" });
    findDirectRoomMock.mockResolvedValue("room-1");

    const result = await startDirectChatAction(null, formData({ userId: "admin-1" }));

    expect(expectOk(result)).toEqual({ roomId: "room-1" });
    expect(createDirectRoomMock).not.toHaveBeenCalled();
  });

  it("creates a new room when none exists", async () => {
    const { startDirectChatAction } = await loadActions();
    getActiveUserMock.mockResolvedValue({ id: "admin-1", name: "Admin" });
    findDirectRoomMock.mockResolvedValue(null);
    createDirectRoomMock.mockResolvedValue("room-new");

    const result = await startDirectChatAction(null, formData({ userId: "admin-1" }));

    expect(expectOk(result)).toEqual({ roomId: "room-new" });
    expect(createDirectRoomMock).toHaveBeenCalledWith("marketer-1", "admin-1");
  });

  it("rejects starting a chat with yourself", async () => {
    const { startDirectChatAction } = await loadActions();

    expectFail(await startDirectChatAction(null, formData({ userId: "marketer-1" })), ErrorCode.VALIDATION_ERROR);
    expect(findDirectRoomMock).not.toHaveBeenCalled();
  });

  it("returns NOT_FOUND for inactive or unknown partners", async () => {
    const { startDirectChatAction } = await loadActions();
    getActiveUserMock.mockResolvedValue(null);

    expectFail(await startDirectChatAction(null, formData({ userId: "ghost" })), ErrorCode.NOT_FOUND);
  });
});

describe("sendChatMessageAction", () => {
  it("sends a message to a room the user belongs to", async () => {
    const { sendChatMessageAction } = await loadActions();
    getRoomForUserMock.mockResolvedValue({ id: "room-1", type: "DIRECT", displayName: "Admin", members: [] });
    createMessageMock.mockResolvedValue({ id: "msg-1" });

    const result = await sendChatMessageAction(null, formData({ roomId: "room-1", body: "안녕하세요" }));

    expect(expectOk(result)).toEqual({ id: "msg-1" });
    expect(createMessageMock).toHaveBeenCalledWith("room-1", "marketer-1", "안녕하세요", undefined);
    expect(revalidatePathMock).toHaveBeenCalledWith("/messages/room-1");
  });

  it("blocks non-members", async () => {
    const { sendChatMessageAction } = await loadActions();
    getRoomForUserMock.mockResolvedValue(null);

    expectFail(await sendChatMessageAction(null, formData({ roomId: "room-9", body: "hi" })), ErrorCode.NOT_FOUND);
    expect(createMessageMock).not.toHaveBeenCalled();
  });

  it("rejects empty messages without an attachment", async () => {
    const { sendChatMessageAction } = await loadActions();
    getRoomForUserMock.mockResolvedValue({ id: "room-1", type: "DIRECT", displayName: "Admin", members: [] });

    const result = await sendChatMessageAction(null, formData({ roomId: "room-1", body: "   " }));

    const error = expectFail(result, ErrorCode.VALIDATION_ERROR);
    expect(error.fieldErrors?.body).toBeDefined();
    expect(createMessageMock).not.toHaveBeenCalled();
  });

  it("stores an attachment and links it to the message", async () => {
    const { sendChatMessageAction } = await loadActions();
    getRoomForUserMock.mockResolvedValue({ id: "room-1", type: "DIRECT", displayName: "Admin", members: [] });
    createStoredFileMock.mockResolvedValue({ id: "file-1", fileName: "report.pdf", mimeType: "application/pdf", size: 3 });
    createMessageMock.mockResolvedValue({ id: "msg-2" });

    const fd = formData({ roomId: "room-1", body: "" });
    fd.set("file", new File([new Uint8Array([1, 2, 3])], "report.pdf", { type: "application/pdf" }));

    const result = await sendChatMessageAction(null, fd);

    expect(expectOk(result)).toEqual({ id: "msg-2" });
    expect(createStoredFileMock).toHaveBeenCalledWith(
      expect.objectContaining({ fileName: "report.pdf", mimeType: "application/pdf", uploadedById: "marketer-1" })
    );
    expect(createMessageMock).toHaveBeenCalledWith("room-1", "marketer-1", "", "file-1");
  });

  it("rejects attachments over the size limit", async () => {
    const { sendChatMessageAction } = await loadActions();
    getRoomForUserMock.mockResolvedValue({ id: "room-1", type: "DIRECT", displayName: "Admin", members: [] });

    const fd = formData({ roomId: "room-1", body: "" });
    fd.set("file", new File([new Uint8Array(4 * 1024 * 1024 + 1)], "big.bin", { type: "application/octet-stream" }));

    const result = await sendChatMessageAction(null, fd);

    const error = expectFail(result, ErrorCode.VALIDATION_ERROR);
    expect(error.fieldErrors?.file).toBeDefined();
    expect(createStoredFileMock).not.toHaveBeenCalled();
    expect(createMessageMock).not.toHaveBeenCalled();
  });
});

describe("createGroupRoomAction", () => {
  function groupForm(entries: Record<string, string>, memberIds: string[]) {
    const fd = formData(entries);
    memberIds.forEach((id) => fd.append("memberIds", id));
    return fd;
  }

  it("creates a group room with active members and links a client", async () => {
    const { createGroupRoomAction } = await loadActions();
    getActiveUserIdsMock.mockResolvedValue(["admin-1", "marketer-2"]);
    getClientAccessInfoMock.mockResolvedValue({ id: "client-1", assignedMarketerId: "marketer-1" });
    createGroupRoomMock.mockResolvedValue("room-g1");

    const result = await createGroupRoomAction(
      null,
      groupForm({ name: "서울덴탈 7월 캠페인", clientId: "client-1" }, ["admin-1", "marketer-2"])
    );

    expect(expectOk(result)).toEqual({ roomId: "room-g1" });
    expect(createGroupRoomMock).toHaveBeenCalledWith(
      "marketer-1",
      "서울덴탈 7월 캠페인",
      ["admin-1", "marketer-2"],
      "client-1"
    );
  });

  it("requires at least one active member", async () => {
    const { createGroupRoomAction } = await loadActions();
    getActiveUserIdsMock.mockResolvedValue([]);

    const result = await createGroupRoomAction(null, groupForm({ name: "빈 방" }, ["ghost"]));

    expectFail(result, ErrorCode.VALIDATION_ERROR);
    expect(createGroupRoomMock).not.toHaveBeenCalled();
  });

  it("blocks linking a client outside the creator's access", async () => {
    const { createGroupRoomAction } = await loadActions();
    getActiveUserIdsMock.mockResolvedValue(["admin-1"]);
    getClientAccessInfoMock.mockResolvedValue({ id: "client-9", assignedMarketerId: "marketer-9" });

    const result = await createGroupRoomAction(
      null,
      groupForm({ name: "남의 거래처 방", clientId: "client-9" }, ["admin-1"])
    );

    expectFail(result, ErrorCode.FORBIDDEN);
    expect(createGroupRoomMock).not.toHaveBeenCalled();
  });

  it("requires a room name", async () => {
    const { createGroupRoomAction } = await loadActions();

    const result = await createGroupRoomAction(null, groupForm({ name: "  " }, ["admin-1"]));

    const error = expectFail(result, ErrorCode.VALIDATION_ERROR);
    expect(error.fieldErrors?.name).toBeDefined();
  });
});
