import { afterEach, describe, expect, it, vi } from "vitest";
import { getIntegrationStatuses, isIntegrationConfigured } from "@/server/integrations/status";

afterEach(() => vi.unstubAllEnvs());

describe("getIntegrationStatuses", () => {
  it("lists every integration with env vars and fallback", () => {
    const statuses = getIntegrationStatuses();
    const keys = statuses.map((status) => status.key);
    expect(keys).toEqual(["naverSearchAd", "kakaoLogin", "kakaoAlimtalk", "email", "toss"]);
    for (const status of statuses) {
      expect(status.envVars.length).toBeGreaterThan(0);
      expect(status.usedIn).toBeTruthy();
      expect(status.fallback).toBeTruthy();
    }
  });

  it("reflects configured state from env", () => {
    vi.stubEnv("EMAIL_API_KEY", "");
    vi.stubEnv("EMAIL_FROM", "");
    expect(isIntegrationConfigured("email")).toBe(false);

    vi.stubEnv("EMAIL_API_KEY", "k");
    vi.stubEnv("EMAIL_FROM", "no-reply@x.com");
    expect(isIntegrationConfigured("email")).toBe(true);
  });

  it("requires all env vars of a group to be set", () => {
    vi.stubEnv("NAVER_AD_API_KEY", "k");
    vi.stubEnv("NAVER_AD_SECRET", "s");
    vi.stubEnv("NAVER_AD_CUSTOMER_ID", "");
    expect(isIntegrationConfigured("naverSearchAd")).toBe(false);
  });
});
