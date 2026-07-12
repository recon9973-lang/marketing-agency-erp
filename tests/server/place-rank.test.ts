import { beforeEach, describe, expect, it, vi } from "vitest";

const keywordFindMany = vi.fn();
const placeUpsert = vi.fn();
const rankCheckMock = vi.fn();
const naverConfiguredMock = vi.fn(() => true);

vi.mock("@/server/db", () => ({
  db: {
    keyword: { findMany: keywordFindMany },
    placeRankRecord: { upsert: placeUpsert },
  },
}));

vi.mock("@/server/marketing/providers/naver", () => ({
  naverResearch: { rankCheck: rankCheckMock },
  naverConfigured: naverConfiguredMock,
}));

async function run() {
  const { runPlaceRankTracking } = await import("@/server/jobs/place-rank");
  return runPlaceRankTracking(new Date("2026-07-12T09:00:00Z"));
}

describe("runPlaceRankTracking", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    naverConfiguredMock.mockReturnValue(true);
  });

  it("네이버 미설정이면 스킵", async () => {
    naverConfiguredMock.mockReturnValue(false);
    const res = await run();
    expect(res.skipped).toBe("NAVER_NOT_CONFIGURED");
    expect(keywordFindMany).not.toHaveBeenCalled();
  });

  it("거래처별로 로컬 순위를 측정해 rank가 있는 것만 기록한다", async () => {
    keywordFindMany.mockResolvedValue([
      { keyword: "강남치과", clientId: "c1", client: { name: "베스트치과" } },
      { keyword: "강남임플란트", clientId: "c1", client: { name: "베스트치과" } },
    ]);
    rankCheckMock.mockResolvedValue({
      ok: true,
      data: [
        { keyword: "강남치과", rank: 3, checkedAt: "t" },
        { keyword: "강남임플란트", rank: null, checkedAt: "t" }, // 노출 안 됨 → 저장 생략
      ],
    });

    const res = await run();

    expect(rankCheckMock).toHaveBeenCalledWith(
      expect.objectContaining({ target: "베스트치과", channel: "local", keywords: ["강남치과", "강남임플란트"] }),
    );
    expect(res).toMatchObject({ clients: 1, keywords: 2, recorded: 1, failed: 0 });
    expect(placeUpsert).toHaveBeenCalledOnce();
    expect(placeUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          clientId_keyword_recordedOn: {
            clientId: "c1",
            keyword: "강남치과",
            recordedOn: new Date(Date.UTC(2026, 6, 12)),
          },
        },
        create: expect.objectContaining({ rank: 3 }),
        update: { rank: 3 },
      }),
    );
  });

  it("rankCheck 실패 시 해당 거래처 키워드를 failed로 집계", async () => {
    keywordFindMany.mockResolvedValue([{ keyword: "강남치과", clientId: "c1", client: { name: "베스트치과" } }]);
    rankCheckMock.mockResolvedValue({ ok: false, error: { code: "CONFIG_MISSING", message: "x" } });
    const res = await run();
    expect(res.failed).toBe(1);
    expect(res.recorded).toBe(0);
    expect(placeUpsert).not.toHaveBeenCalled();
  });

  it("거래처명이 없으면 제외한다", async () => {
    keywordFindMany.mockResolvedValue([{ keyword: "강남치과", clientId: "c9", client: { name: "  " } }]);
    const res = await run();
    expect(res.clients).toBe(0);
    expect(rankCheckMock).not.toHaveBeenCalled();
  });
});
