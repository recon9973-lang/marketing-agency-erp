import { beforeEach, describe, expect, it, vi } from "vitest";
import { ErrorCode } from "@/server/errors";
import { marketerUser, superAdminUser } from "../helpers/users";
import { expectFail, expectOk } from "../helpers/action-result";

const getCurrentUserMock = vi.fn();
const loadAccessScopesMock = vi.fn();
const getClientAccessInfoMock = vi.fn();
const upsertPlaceRankMock = vi.fn();
const getPlaceRankAccessInfoMock = vi.fn();
const deletePlaceRankMock = vi.fn();
const writeAuditLogMock = vi.fn();
const revalidatePathMock = vi.fn();

vi.mock("@/server/session", () => ({ getCurrentUser: getCurrentUserMock }));
vi.mock("@/server/scope", () => ({ loadAccessScopes: loadAccessScopesMock }));
vi.mock("@/server/repositories/clients", () => ({ getClientAccessInfo: getClientAccessInfoMock }));
vi.mock("@/server/repositories/place-rank", () => ({
  upsertPlaceRank: upsertPlaceRankMock,
  getPlaceRankAccessInfo: getPlaceRankAccessInfoMock,
  deletePlaceRank: deletePlaceRankMock
}));
vi.mock("@/server/audit", async () => {
  const actual = await vi.importActual<typeof import("@/server/audit")>("@/server/audit");
  return { ...actual, writeAuditLog: writeAuditLogMock };
});
vi.mock("next/cache", () => ({ revalidatePath: revalidatePathMock }));

async function loadActions() {
  return import("@/server/actions/place-rank");
}

function formData(entries: Record<string, string>) {
  const fd = new FormData();
  for (const [key, value] of Object.entries(entries)) {
    fd.set(key, value);
  }
  return fd;
}

const validRank = {
  clientId: "client-1",
  keyword: "강남 치과",
  rank: "3",
  recordedOn: "2026-07-03",
  memo: "리뷰 이벤트 시작"
};

beforeEach(() => {
  vi.clearAllMocks();
  loadAccessScopesMock.mockResolvedValue([]);
  writeAuditLogMock.mockResolvedValue(true);
  getClientAccessInfoMock.mockResolvedValue({ id: "client-1", assignedMarketerId: "marketer-1" });
  upsertPlaceRankMock.mockResolvedValue({ id: "rank-1" });
});

describe("recordPlaceRankAction", () => {
  it("records a rank for an accessible client and writes an audit log", async () => {
    const { recordPlaceRankAction } = await loadActions();
    getCurrentUserMock.mockResolvedValue(marketerUser({ id: "marketer-1" }));

    const result = await recordPlaceRankAction(null, formData(validRank));

    expect(expectOk(result)).toEqual({ id: "rank-1" });
    expect(upsertPlaceRankMock).toHaveBeenCalledWith(
      {
        clientId: "client-1",
        keyword: "강남 치과",
        rank: 3,
        recordedOn: new Date("2026-07-03T00:00:00.000Z"),
        memo: "리뷰 이벤트 시작"
      },
      "marketer-1"
    );
    expect(writeAuditLogMock).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "PLACE_RANK_RECORDED",
        targetType: "PlaceRankRecord",
        targetId: "rank-1"
      })
    );
    expect(revalidatePathMock).toHaveBeenCalledWith("/clients/client-1/ranks");
  });

  it("returns NOT_FOUND when the client does not exist", async () => {
    const { recordPlaceRankAction } = await loadActions();
    getCurrentUserMock.mockResolvedValue(superAdminUser());
    getClientAccessInfoMock.mockResolvedValue(null);

    expectFail(await recordPlaceRankAction(null, formData(validRank)), ErrorCode.NOT_FOUND);
    expect(upsertPlaceRankMock).not.toHaveBeenCalled();
  });

  it("forbids marketers from recording for another marketer's client", async () => {
    const { recordPlaceRankAction } = await loadActions();
    getCurrentUserMock.mockResolvedValue(marketerUser({ id: "marketer-2" }));

    expectFail(await recordPlaceRankAction(null, formData(validRank)), ErrorCode.FORBIDDEN);
    expect(upsertPlaceRankMock).not.toHaveBeenCalled();
  });

  it("rejects invalid rank and empty keyword with field errors", async () => {
    const { recordPlaceRankAction } = await loadActions();
    getCurrentUserMock.mockResolvedValue(superAdminUser());

    const result = await recordPlaceRankAction(
      null,
      formData({ ...validRank, keyword: " ", rank: "0" })
    );

    const error = expectFail(result, ErrorCode.VALIDATION_ERROR);
    expect(error.fieldErrors?.keyword).toBeDefined();
    expect(error.fieldErrors?.rank).toEqual(["순위는 1 이상이어야 합니다."]);
    expect(upsertPlaceRankMock).not.toHaveBeenCalled();
  });
});

describe("deletePlaceRankAction", () => {
  const storedRank = {
    id: "rank-1",
    clientId: "client-1",
    keyword: "강남 치과",
    rank: 3,
    recordedOn: new Date("2026-07-03T00:00:00.000Z")
  };

  it("deletes a record for an accessible client with an audit trail", async () => {
    const { deletePlaceRankAction } = await loadActions();
    getCurrentUserMock.mockResolvedValue(marketerUser({ id: "marketer-1" }));
    getPlaceRankAccessInfoMock.mockResolvedValue(storedRank);
    deletePlaceRankMock.mockResolvedValue({ id: "rank-1" });

    const result = await deletePlaceRankAction(null, formData({ id: "rank-1" }));

    expect(expectOk(result)).toEqual({ id: "rank-1" });
    expect(deletePlaceRankMock).toHaveBeenCalledWith("rank-1");
    expect(writeAuditLogMock).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "PLACE_RANK_DELETED",
        beforeState: expect.objectContaining({ keyword: "강남 치과", rank: 3, recordedOn: "2026-07-03" })
      })
    );
  });

  it("returns NOT_FOUND for a missing record", async () => {
    const { deletePlaceRankAction } = await loadActions();
    getCurrentUserMock.mockResolvedValue(superAdminUser());
    getPlaceRankAccessInfoMock.mockResolvedValue(null);

    expectFail(await deletePlaceRankAction(null, formData({ id: "missing" })), ErrorCode.NOT_FOUND);
    expect(deletePlaceRankMock).not.toHaveBeenCalled();
  });

  it("forbids marketers from deleting another marketer's client record", async () => {
    const { deletePlaceRankAction } = await loadActions();
    getCurrentUserMock.mockResolvedValue(marketerUser({ id: "marketer-2" }));
    getPlaceRankAccessInfoMock.mockResolvedValue(storedRank);

    expectFail(await deletePlaceRankAction(null, formData({ id: "rank-1" })), ErrorCode.FORBIDDEN);
    expect(deletePlaceRankMock).not.toHaveBeenCalled();
  });
});
