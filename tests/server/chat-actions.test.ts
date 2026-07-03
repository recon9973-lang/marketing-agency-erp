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
const revalidatePathMock = vi.fn();

vi.mock("@/server/session", () => ({ getCurrentUser: getCurrentUserMock }));
vi.mock("@/server/repositories/chat", () => ({
  getRoomForUser: getRoomForUserMock,
  createMessage: createMessageMock,
  findDirectRoom: findDirectRoomMock,
  createDirectRoom: createDirectRoomMock,
  getActiveUser: getActiveUserMock
}));
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
    expect(createMessageMock).toHaveBeenCalledWith("room-1", "marketer-1", "안녕하세요");
    expect(revalidatePathMock).toHaveBeenCalledWith("/messages/room-1");
  });

  it("blocks non-members", async () => {
    const { sendChatMessageAction } = await loadActions();
    getRoomForUserMock.mockResolvedValue(null);

    expectFail(await sendChatMessageAction(null, formData({ roomId: "room-9", body: "hi" })), ErrorCode.NOT_FOUND);
    expect(createMessageMock).not.toHaveBeenCalled();
  });

  it("rejects empty messages", async () => {
    const { sendChatMessageAction } = await loadActions();

    const result = await sendChatMessageAction(null, formData({ roomId: "room-1", body: "   " }));

    const error = expectFail(result, ErrorCode.VALIDATION_ERROR);
    expect(error.fieldErrors?.body).toBeDefined();
    expect(createMessageMock).not.toHaveBeenCalled();
  });
});
