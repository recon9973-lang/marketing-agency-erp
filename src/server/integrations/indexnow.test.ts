import { afterEach, describe, expect, it, vi } from "vitest";
import { indexNowConfigured, isSameHostUrl, submitIndexNow, pingSitemaps } from "./indexnow";

const ORIG = { ...process.env };
afterEach(() => {
  process.env = { ...ORIG };
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("isSameHostUrl", () => {
  it("같은 호스트의 http(s) URL만 허용", () => {
    expect(isSameHostUrl("https://seokorea.org/a", "seokorea.org")).toBe(true);
    expect(isSameHostUrl("https://SeoKorea.org/a", "seokorea.org")).toBe(true); // 대소문자 무시
    expect(isSameHostUrl("https://other.com/a", "seokorea.org")).toBe(false);
    expect(isSameHostUrl("ftp://seokorea.org/a", "seokorea.org")).toBe(false);
    expect(isSameHostUrl("not-a-url", "seokorea.org")).toBe(false);
  });
});

describe("indexNowConfigured", () => {
  it("KEY·HOST 모두 있어야 true", () => {
    delete process.env.INDEXNOW_KEY;
    delete process.env.INDEXNOW_HOST;
    expect(indexNowConfigured()).toBe(false);
    process.env.INDEXNOW_KEY = "k";
    expect(indexNowConfigured()).toBe(false);
    process.env.INDEXNOW_HOST = "seokorea.org";
    expect(indexNowConfigured()).toBe(true);
  });
});

describe("submitIndexNow", () => {
  it("미설정 시 네트워크 호출 없이 skip", async () => {
    delete process.env.INDEXNOW_KEY;
    delete process.env.INDEXNOW_HOST;
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    const r = await submitIndexNow(["https://seokorea.org/a"]);
    expect(r.ok).toBe(false);
    expect(r.reason).toBe("NOT_CONFIGURED");
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("호스트 외 URL은 제외하고 중복 제거 후 제출", async () => {
    process.env.INDEXNOW_KEY = "key123";
    process.env.INDEXNOW_HOST = "seokorea.org";
    delete process.env.INDEXNOW_KEY_LOCATION;
    const fetchSpy = vi.fn((_url: string, _init?: RequestInit) => Promise.resolve({ status: 200 } as Response));
    vi.stubGlobal("fetch", fetchSpy);
    const r = await submitIndexNow([
      "https://seokorea.org/a",
      "https://seokorea.org/a", // 중복
      "https://other.com/b" // 타 호스트
    ]);
    expect(r.ok).toBe(true);
    expect(r.submitted).toBe(1);
    expect(r.skipped).toBe(2);
    const body = JSON.parse((fetchSpy.mock.calls[0][1] as RequestInit).body as string);
    expect(body.host).toBe("seokorea.org");
    expect(body.urlList).toEqual(["https://seokorea.org/a"]);
    expect(body.keyLocation).toBe("https://seokorea.org/key123.txt");
  });

  it("비2xx 응답은 실패로 처리", async () => {
    process.env.INDEXNOW_KEY = "k";
    process.env.INDEXNOW_HOST = "seokorea.org";
    vi.stubGlobal("fetch", vi.fn(async () => ({ status: 403 }) as Response));
    const r = await submitIndexNow(["https://seokorea.org/a"]);
    expect(r.ok).toBe(false);
    expect(r.status).toBe(403);
  });
});

describe("pingSitemaps", () => {
  it("sitemap URL 없으면 skip", async () => {
    delete process.env.SITEMAP_URL;
    const r = await pingSitemaps();
    expect(r.ok).toBe(false);
    expect(r.engines).toEqual([]);
  });

  it("URL 있으면 빙 핑 시도", async () => {
    const fetchSpy = vi.fn(async () => ({ status: 200 }) as Response);
    vi.stubGlobal("fetch", fetchSpy);
    const r = await pingSitemaps("https://seokorea.org/sitemap.xml");
    expect(r.ok).toBe(true);
    expect(r.engines[0].engine).toBe("bing");
    expect(fetchSpy).toHaveBeenCalledOnce();
  });
});
