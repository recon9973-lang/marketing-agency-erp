import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fetchRelatedKeywords, fetchBidEstimates, naverSearchConfigured, toCount } from "./naver-search";

// 검색광고 키가 없는 환경(기본 CI)에서의 정직성 계약을 고정한다.
describe("naver-search · fetchRelatedKeywords 정직성", () => {
  const saved = { ...process.env };
  beforeEach(() => {
    delete process.env.NAVER_AD_API_KEY;
    delete process.env.NAVER_AD_SECRET;
    delete process.env.NAVER_AD_CUSTOMER_ID;
  });
  afterEach(() => {
    process.env = { ...saved };
  });

  it("미연동이면 연관키워드를 지어내지 않고 빈 배열", async () => {
    expect(naverSearchConfigured()).toBe(false);
    await expect(fetchRelatedKeywords("임플란트")).resolves.toEqual([]);
  });
  it("빈 시드는 빈 배열", async () => {
    await expect(fetchRelatedKeywords("   ")).resolves.toEqual([]);
  });
});

describe("naver-search · fetchBidEstimates 응답 파싱(estimate 배열)", () => {
  const saved = { ...process.env };
  beforeEach(() => {
    process.env.NAVER_AD_API_KEY = "k";
    process.env.NAVER_AD_SECRET = "s";
    process.env.NAVER_AD_CUSTOMER_ID = "c";
  });
  afterEach(() => {
    process.env = { ...saved };
    vi.restoreAllMocks();
  });

  it("네이버는 결과를 estimate[]로 주므로 estimate에서 CPC를 읽는다", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ device: "MOBILE", estimate: [{ keyword: "춘천 피부과", position: 2, bid: 6120 }] }), { status: 200 })
    );
    const out = await fetchBidEstimates(["춘천 피부과"]);
    expect(out.get("춘천 피부과")).toBe(6120); // items로 잘못 읽던 버그면 null이었을 것
  });

  it("비-200이면 전건 null(방어)", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("bad", { status: 400 }));
    const out = await fetchBidEstimates(["춘천 피부과"]);
    expect(out.get("춘천 피부과")).toBeNull();
  });
});

describe("naver-search · toCount(< 10·콤마 정규화)", () => {
  it("문자열/숫자/미만표기 처리", () => {
    expect(toCount("1,200")).toBe(1200);
    expect(toCount("< 10")).toBe(10); // 자릿수만 추출(보수적)
    expect(toCount(340)).toBe(340);
    expect(toCount("")).toBeNull();
    expect(toCount(null)).toBeNull();
  });
});
