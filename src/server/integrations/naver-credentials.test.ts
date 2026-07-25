import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { naverOpenApiCreds, naverOpenApiConfigured } from "./naver-credentials";

const KEYS = ["NAVER_CLIENT_ID", "NAVER_CLIENT_SECRET", "NAVER_SEARCH_CLIENT_ID", "NAVER_SEARCH_CLIENT_SECRET"];

describe("naverOpenApiCreds (이름 어느 쪽이든 인식)", () => {
  let saved: Record<string, string | undefined>;
  beforeEach(() => {
    saved = Object.fromEntries(KEYS.map((k) => [k, process.env[k]]));
    KEYS.forEach((k) => delete process.env[k]);
  });
  afterEach(() => {
    KEYS.forEach((k) => (saved[k] === undefined ? delete process.env[k] : (process.env[k] = saved[k]!)));
  });

  it("아무 키도 없으면 null", () => {
    expect(naverOpenApiCreds()).toBeNull();
    expect(naverOpenApiConfigured()).toBe(false);
  });

  it("NAVER_CLIENT_* 만 있어도 인식", () => {
    process.env.NAVER_CLIENT_ID = "cid";
    process.env.NAVER_CLIENT_SECRET = "csec";
    expect(naverOpenApiCreds()).toEqual({ id: "cid", secret: "csec" });
    expect(naverOpenApiConfigured()).toBe(true);
  });

  it("NAVER_SEARCH_CLIENT_* 만 있어도 인식(대체 이름)", () => {
    process.env.NAVER_SEARCH_CLIENT_ID = "sid";
    process.env.NAVER_SEARCH_CLIENT_SECRET = "ssec";
    expect(naverOpenApiCreds()).toEqual({ id: "sid", secret: "ssec" });
  });

  it("둘 다 있으면 NAVER_CLIENT_* 우선", () => {
    process.env.NAVER_CLIENT_ID = "cid";
    process.env.NAVER_CLIENT_SECRET = "csec";
    process.env.NAVER_SEARCH_CLIENT_ID = "sid";
    process.env.NAVER_SEARCH_CLIENT_SECRET = "ssec";
    expect(naverOpenApiCreds()).toEqual({ id: "cid", secret: "csec" });
  });

  it("id/secret 이름이 엇갈려도 채워지면 인식", () => {
    process.env.NAVER_CLIENT_ID = "cid";
    process.env.NAVER_SEARCH_CLIENT_SECRET = "ssec";
    expect(naverOpenApiCreds()).toEqual({ id: "cid", secret: "ssec" });
  });
});
