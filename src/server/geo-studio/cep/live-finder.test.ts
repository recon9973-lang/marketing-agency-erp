import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { cepRealConfigured, discoverCepsLive } from "./live-finder";

// 키 미설정(기본 CI)에서 실측 CEP는 절대 지어내지 않고 데모로 강등되어야 한다.
describe("live-finder · 정직성(미연결 → 데모)", () => {
  const saved = { ...process.env };
  beforeEach(() => {
    delete process.env.NAVER_AD_API_KEY;
    delete process.env.NAVER_AD_SECRET;
    delete process.env.NAVER_AD_CUSTOMER_ID;
    delete process.env.OPENAI_API_KEY;
  });
  afterEach(() => {
    process.env = { ...saved };
  });

  it("연관키워드·임베딩 미연결이면 cepRealConfigured=false", () => {
    expect(cepRealConfigured()).toBe(false);
  });

  it("discoverCepsLive는 미연결 시 data_tier=demo, ceps 빈 배열, 안내 note", async () => {
    const r = await discoverCepsLive("햇살숙소", "제주 숙소", { scanDate: "2026-07-19T00:00:00Z" });
    expect(r.data_tier).toBe("demo");
    expect(r.ceps).toEqual([]);
    expect(r.total_ceps).toBe(0);
    expect(r.note).toBeTruthy();
    expect(r.sources).toEqual({ relatedKeywords: false, embeddings: false });
  });
});
