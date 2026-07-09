import { afterEach, describe, expect, it, vi } from "vitest";
import { confirmTossPayment, tossClientKey, tossConfigured } from "@/server/integrations/toss";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("tossConfigured / tossClientKey", () => {
  it("reflects env presence", () => {
    vi.stubEnv("TOSS_SECRET_KEY", "");
    vi.stubEnv("TOSS_CLIENT_KEY", "");
    expect(tossConfigured()).toBe(false);
    expect(tossClientKey()).toBeNull();

    vi.stubEnv("TOSS_SECRET_KEY", "test_sk");
    vi.stubEnv("TOSS_CLIENT_KEY", "test_ck");
    expect(tossConfigured()).toBe(true);
    expect(tossClientKey()).toBe("test_ck");
  });
});

describe("confirmTossPayment", () => {
  it("throws when unconfigured (never calls network)", async () => {
    vi.stubEnv("TOSS_SECRET_KEY", "");
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    await expect(confirmTossPayment({ paymentKey: "p", orderId: "o", amount: 1000 })).rejects.toThrow();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("uses Basic auth with the secret key and parses DONE", async () => {
    vi.stubEnv("TOSS_SECRET_KEY", "test_sk");
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ status: "DONE", paymentKey: "pk_1", method: "카드", approvedAt: "2026-07-04T00:00:00+09:00" }), {
        status: 200
      })
    );

    const result = await confirmTossPayment({ paymentKey: "pk_1", orderId: "order-1", amount: 55000 });

    expect(result.approved).toBe(true);
    expect(result.method).toBe("카드");
    const [url, init] = fetchSpy.mock.calls[0];
    expect(String(url)).toContain("api.tosspayments.com/v1/payments/confirm");
    const headers = (init?.headers ?? {}) as Record<string, string>;
    // Basic base64("test_sk:")
    expect(headers.Authorization).toBe(`Basic ${Buffer.from("test_sk:").toString("base64")}`);
  });

  it("throws with the provider message on failure", async () => {
    vi.stubEnv("TOSS_SECRET_KEY", "test_sk");
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ message: "이미 처리된 결제입니다." }), { status: 400 })
    );

    await expect(confirmTossPayment({ paymentKey: "p", orderId: "o", amount: 1 })).rejects.toThrow(/이미 처리된 결제/);
  });
});
