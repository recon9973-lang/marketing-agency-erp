import { beforeEach, describe, expect, it, vi } from "vitest";
import { ErrorCode } from "@/server/errors";
import { marketerUser, superAdminUser } from "../helpers/users";
import { expectFail, expectOk } from "../helpers/action-result";

const getCurrentUserMock = vi.fn();
const loadAccessScopesMock = vi.fn();
const getClientAccessInfoMock = vi.fn();
const toggleFavoriteClientMock = vi.fn();
const revalidatePathMock = vi.fn();

vi.mock("@/server/session", () => ({ getCurrentUser: getCurrentUserMock }));
vi.mock("@/server/scope", () => ({ loadAccessScopes: loadAccessScopesMock }));
vi.mock("@/server/repositories/clients", () => ({ getClientAccessInfo: getClientAccessInfoMock }));
vi.mock("@/server/repositories/favorites", () => ({ toggleFavoriteClient: toggleFavoriteClientMock }));
vi.mock("next/cache", () => ({ revalidatePath: revalidatePathMock }));

async function loadActions() {
  return import("@/server/actions/favorites");
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
  loadAccessScopesMock.mockResolvedValue([]);
  getClientAccessInfoMock.mockResolvedValue({ id: "client-1", assignedMarketerId: "marketer-1" });
});

describe("toggleClientFavoriteAction", () => {
  it("toggles a favorite for an accessible client", async () => {
    const { toggleClientFavoriteAction } = await loadActions();
    getCurrentUserMock.mockResolvedValue(marketerUser({ id: "marketer-1" }));
    toggleFavoriteClientMock.mockResolvedValue(true);

    const result = await toggleClientFavoriteAction(null, formData({ clientId: "client-1" }));

    expect(expectOk(result)).toEqual({ clientId: "client-1", favored: true });
    expect(toggleFavoriteClientMock).toHaveBeenCalledWith("marketer-1", "client-1");
    expect(revalidatePathMock).toHaveBeenCalledWith("/clients");
  });

  it("returns NOT_FOUND for a missing client", async () => {
    const { toggleClientFavoriteAction } = await loadActions();
    getCurrentUserMock.mockResolvedValue(superAdminUser());
    getClientAccessInfoMock.mockResolvedValue(null);

    expectFail(await toggleClientFavoriteAction(null, formData({ clientId: "missing" })), ErrorCode.NOT_FOUND);
    expect(toggleFavoriteClientMock).not.toHaveBeenCalled();
  });

  it("forbids marketers from favoriting another marketer's client", async () => {
    const { toggleClientFavoriteAction } = await loadActions();
    getCurrentUserMock.mockResolvedValue(marketerUser({ id: "marketer-2" }));

    expectFail(await toggleClientFavoriteAction(null, formData({ clientId: "client-1" })), ErrorCode.FORBIDDEN);
    expect(toggleFavoriteClientMock).not.toHaveBeenCalled();
  });
});
