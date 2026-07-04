import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { buildReportEmail } from "@/server/email/report-template";
import { emailConfigured, sendEmail } from "@/server/integrations/email";
import type { ReportEmailData } from "@/server/repositories/reports";

const reportData: ReportEmailData = {
  title: "7월 블로그·플레이스 성과",
  clientName: "서울치과",
  contactEmail: "manager@seoul-dental.example",
  reportingMonth: new Date("2026-07-01T00:00:00.000Z"),
  metrics: [
    { label: "블로그 방문", value: "12,400" },
    { label: "플레이스 순위", value: "3위" }
  ],
  notes: "다음 달엔 <이벤트> 배너를 추가합니다."
};

describe("buildReportEmail", () => {
  it("includes client, month, metrics, and escapes HTML in notes", () => {
    const msg = buildReportEmail(reportData, "to@x.com");
    expect(msg.to).toBe("to@x.com");
    expect(msg.subject).toContain("서울치과");
    expect(msg.subject).toContain("2026년 7월");
    expect(msg.html).toContain("블로그 방문");
    expect(msg.html).toContain("12,400");
    // notes의 <이벤트> 가 이스케이프돼야 한다(HTML 주입 방지).
    expect(msg.html).toContain("&lt;이벤트&gt;");
    expect(msg.html).not.toContain("<이벤트>");
    expect(msg.text).toContain("- 블로그 방문: 12,400");
  });
});

describe("sendEmail", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it("does not send and returns a preview when unconfigured", async () => {
    vi.stubEnv("EMAIL_API_KEY", "");
    vi.stubEnv("EMAIL_FROM", "");
    const fetchSpy = vi.spyOn(globalThis, "fetch");

    expect(emailConfigured()).toBe(false);
    const result = await sendEmail({ to: "a@b.com", subject: "s", html: "<p>x</p>" });

    expect(result.sent).toBe(false);
    expect(result.preview.subject).toBe("s");
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("posts to the provider when configured", async () => {
    vi.stubEnv("EMAIL_API_KEY", "re_key");
    vi.stubEnv("EMAIL_FROM", "no-reply@venom.example");
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(new Response(JSON.stringify({ id: "email-1" }), { status: 200 }));

    const result = await sendEmail({ to: "a@b.com", subject: "s", html: "<p>x</p>" });

    expect(result.sent).toBe(true);
    expect(result.id).toBe("email-1");
    const [url, init] = fetchSpy.mock.calls[0];
    expect(String(url)).toContain("resend.com");
    const headers = (init?.headers ?? {}) as Record<string, string>;
    expect(headers.Authorization).toBe("Bearer re_key");
  });

  it("throws on a provider error", async () => {
    vi.stubEnv("EMAIL_API_KEY", "re_key");
    vi.stubEnv("EMAIL_FROM", "no-reply@venom.example");
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("bad", { status: 422 }));

    await expect(sendEmail({ to: "a@b.com", subject: "s", html: "x" })).rejects.toThrow(/422/);
  });
});
