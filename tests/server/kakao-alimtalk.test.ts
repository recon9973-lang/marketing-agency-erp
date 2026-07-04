import { afterEach, describe, expect, it, vi } from "vitest";
import { alimtalkConfigured, normalizePhone, sendAlimtalk } from "@/server/integrations/kakao-alimtalk";
import { buildReportAlimtalk } from "@/server/messaging/report-alimtalk";
import type { ReportEmailData } from "@/server/repositories/reports";

const reportData: ReportEmailData = {
  title: "7월 성과",
  clientName: "서울치과",
  contactEmail: null,
  contactPhone: "010-1234-5678",
  reportingMonth: new Date("2026-07-01T00:00:00.000Z"),
  metrics: [],
  notes: null
};

describe("normalizePhone", () => {
  it("strips non-digits", () => {
    expect(normalizePhone("010-1234-5678")).toBe("01012345678");
    expect(normalizePhone("+82 10 1234 5678")).toBe("821012345678");
  });
});

describe("buildReportAlimtalk", () => {
  it("includes client, month, and title", () => {
    const msg = buildReportAlimtalk(reportData, "01012345678");
    expect(msg.to).toBe("01012345678");
    expect(msg.templateName).toBe("report_ready");
    expect(msg.text).toContain("서울치과");
    expect(msg.text).toContain("2026년 7월");
    expect(msg.text).toContain("7월 성과");
  });
});

describe("sendAlimtalk", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it("previews (no send) and normalizes phone when unconfigured", async () => {
    vi.stubEnv("KAKAO_ALIMTALK_API_KEY", "");
    vi.stubEnv("KAKAO_ALIMTALK_SENDER", "");
    vi.stubEnv("KAKAO_ALIMTALK_ENDPOINT", "");
    const fetchSpy = vi.spyOn(globalThis, "fetch");

    expect(alimtalkConfigured()).toBe(false);
    const result = await sendAlimtalk({ to: "010-1234-5678", templateName: "t", text: "hi" });

    expect(result.sent).toBe(false);
    expect(result.preview.to).toBe("01012345678");
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("posts to the configured endpoint when configured", async () => {
    vi.stubEnv("KAKAO_ALIMTALK_API_KEY", "key");
    vi.stubEnv("KAKAO_ALIMTALK_SENDER", "sender-key");
    vi.stubEnv("KAKAO_ALIMTALK_ENDPOINT", "https://provider.example/alimtalk");
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(new Response(JSON.stringify({ messageId: "m-1" }), { status: 200 }));

    const result = await sendAlimtalk({ to: "010-1234-5678", templateName: "report_ready", text: "hi" });

    expect(result.sent).toBe(true);
    expect(result.id).toBe("m-1");
    const [url, init] = fetchSpy.mock.calls[0];
    expect(String(url)).toContain("provider.example");
    const headers = (init?.headers ?? {}) as Record<string, string>;
    expect(headers.Authorization).toBe("Bearer key");
  });

  it("throws on provider error", async () => {
    vi.stubEnv("KAKAO_ALIMTALK_API_KEY", "key");
    vi.stubEnv("KAKAO_ALIMTALK_SENDER", "sender-key");
    vi.stubEnv("KAKAO_ALIMTALK_ENDPOINT", "https://provider.example/alimtalk");
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("bad", { status: 500 }));

    await expect(sendAlimtalk({ to: "01012345678", templateName: "t", text: "x" })).rejects.toThrow(/500/);
  });
});
