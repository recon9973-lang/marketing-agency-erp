import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ErrorCode } from "@/server/errors";
import { marketerUser } from "../helpers/users";
import { expectFail, expectOk } from "../helpers/action-result";

const getCurrentUserMock = vi.fn();
vi.mock("@/server/session", () => ({ getCurrentUser: getCurrentUserMock }));

async function loadActions() {
  return import("@/server/actions/keywords");
}

function formData(entries: Record<string, string>) {
  const fd = new FormData();
  for (const [key, value] of Object.entries(entries)) fd.set(key, value);
  return fd;
}

beforeEach(() => {
  vi.clearAllMocks();
  getCurrentUserMock.mockResolvedValue(marketerUser({ id: "marketer-1" }));
  // 미연동(데모) 경로로 강제 → 네트워크 호출 없음
  vi.stubEnv("NAVER_AD_API_KEY", "");
  vi.stubEnv("NAVER_AD_SECRET", "");
  vi.stubEnv("NAVER_AD_CUSTOMER_ID", "");
  vi.stubEnv("NAVER_CLIENT_ID", "");
  vi.stubEnv("NAVER_CLIENT_SECRET", "");
});

afterEach(() => vi.unstubAllEnvs());

describe("lookupKeywordVolumeAction", () => {
  it("returns demo volume when nothing is configured", async () => {
    const { lookupKeywordVolumeAction } = await loadActions();

    const result = await lookupKeywordVolumeAction(null, formData({ keywords: "강남치과, 임플란트" }));

    const data = expectOk(result);
    expect(data.mode).toBe("volume");
    if (data.mode === "volume") {
      expect(data.source).toBe("demo");
      expect(data.volume).toHaveLength(2);
      expect(data.volume.every((row) => row.estimated)).toBe(true);
    }
  });

  it("returns real trend when DataLab is configured", async () => {
    const { lookupKeywordVolumeAction } = await loadActions();
    vi.stubEnv("NAVER_CLIENT_ID", "cid");
    vi.stubEnv("NAVER_CLIENT_SECRET", "csecret");
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          results: [{ title: "강남치과", data: [{ period: "2026-01-01", ratio: 50 }, { period: "2026-02-01", ratio: 75 }] }]
        }),
        { status: 200 }
      )
    );

    const result = await lookupKeywordVolumeAction(null, formData({ keywords: "강남치과" }));

    const data = expectOk(result);
    expect(data.mode).toBe("trend");
    if (data.mode === "trend") {
      expect(data.source).toBe("datalab");
      expect(data.trend[0].latestRatio).toBe(75);
      expect(data.trend[0].delta).toBe(25);
    }
    vi.restoreAllMocks();
  });

  it("rejects empty input", async () => {
    const { lookupKeywordVolumeAction } = await loadActions();

    expectFail(await lookupKeywordVolumeAction(null, formData({ keywords: "   " })), ErrorCode.VALIDATION_ERROR);
  });
});
