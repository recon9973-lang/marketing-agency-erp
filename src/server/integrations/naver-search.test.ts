import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { fetchRelatedKeywords, naverSearchConfigured, toCount } from "./naver-search";

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

describe("naver-search · toCount(< 10·콤마 정규화)", () => {
  it("문자열/숫자/미만표기 처리", () => {
    expect(toCount("1,200")).toBe(1200);
    expect(toCount("< 10")).toBe(10); // 자릿수만 추출(보수적)
    expect(toCount(340)).toBe(340);
    expect(toCount("")).toBeNull();
    expect(toCount(null)).toBeNull();
  });
});
