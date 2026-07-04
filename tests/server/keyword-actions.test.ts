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
});

afterEach(() => vi.unstubAllEnvs());

describe("lookupKeywordVolumeAction", () => {
  it("returns demo results when not configured", async () => {
    const { lookupKeywordVolumeAction } = await loadActions();

    const result = await lookupKeywordVolumeAction(null, formData({ keywords: "강남치과, 임플란트" }));

    const data = expectOk(result);
    expect(data.configured).toBe(false);
    expect(data.results).toHaveLength(2);
    expect(data.results.every((row) => row.estimated)).toBe(true);
  });

  it("rejects empty input", async () => {
    const { lookupKeywordVolumeAction } = await loadActions();

    expectFail(await lookupKeywordVolumeAction(null, formData({ keywords: "   " })), ErrorCode.VALIDATION_ERROR);
  });
});
