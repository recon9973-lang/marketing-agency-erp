import { beforeEach, describe, expect, it, vi } from "vitest";

const reportFindMany = vi.fn();
const keywordFindMany = vi.fn();
const channelConnFindFirst = vi.fn();

vi.mock("@/server/db", () => ({
  db: {
    report: { findMany: reportFindMany },
    keyword: { findMany: keywordFindMany },
    channelConnection: { findFirst: channelConnFindFirst },
  },
}));

// naver provider는 config 빌드 경로에서 호출되지 않지만, import 그래프 안전을 위해 목킹.
vi.mock("@/server/marketing/providers/naver", () => ({ naverResearch: {} }));

describe("buildMonthlyPerfConfig / hostFromGscSiteUrl", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it("sc-domain: 과 https:// 형식을 모두 호스트로 정규화한다", async () => {
    const { hostFromGscSiteUrl } = await import("@/server/marketing/research");
    expect(hostFromGscSiteUrl("sc-domain:example.co.kr")).toBe("example.co.kr");
    expect(hostFromGscSiteUrl("https://example.co.kr/")).toBe("example.co.kr");
    expect(hostFromGscSiteUrl("https://sub.example.co.kr/path/x")).toBe("sub.example.co.kr");
  });

  it("보고서 있는 거래처의 키워드+GSC 대상으로 설정을 구성한다", async () => {
    reportFindMany.mockResolvedValue([{ clientId: "c1" }, { clientId: "c1" }, { clientId: "c2" }]);
    keywordFindMany.mockImplementation(({ where }: { where: { clientId: string } }) =>
      where.clientId === "c1"
        ? Promise.resolve([{ keyword: "강남 임플란트" }, { keyword: "임플란트 비용" }])
        : Promise.resolve([{ keyword: "라식" }]),
    );
    channelConnFindFirst.mockImplementation(({ where }: { where: { clientId: string } }) =>
      where.clientId === "c1"
        ? Promise.resolve({ gscSiteUrl: "https://c1clinic.co.kr/" })
        : Promise.resolve(null), // c2는 GSC 연결 없음 → 제외
    );

    const { buildMonthlyPerfConfig } = await import("@/server/marketing/research");
    const config = await buildMonthlyPerfConfig("2026-07-01" as unknown as Date);

    expect(Object.keys(config)).toEqual(["c1"]); // c2는 대상 없어 제외
    expect(config.c1).toEqual({
      keywords: ["강남 임플란트", "임플란트 비용"],
      target: "c1clinic.co.kr",
      channel: "web",
    });
  });

  it("키워드가 없으면 해당 거래처를 제외한다", async () => {
    reportFindMany.mockResolvedValue([{ clientId: "c3" }]);
    keywordFindMany.mockResolvedValue([]);
    channelConnFindFirst.mockResolvedValue({ gscSiteUrl: "sc-domain:c3.co.kr" });

    const { buildMonthlyPerfConfig } = await import("@/server/marketing/research");
    const config = await buildMonthlyPerfConfig("2026-07-01" as unknown as Date);
    expect(config).toEqual({});
  });
});
