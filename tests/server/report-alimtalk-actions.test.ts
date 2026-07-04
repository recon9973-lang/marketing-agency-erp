import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ErrorCode } from "@/server/errors";
import { adminUser } from "../helpers/users";
import { expectFail, expectOk } from "../helpers/action-result";

const getCurrentUserMock = vi.fn();
const getReportAccessInfoMock = vi.fn();
const getReportEmailDataMock = vi.fn();
const loadAccessScopesMock = vi.fn();

vi.mock("@/server/session", () => ({ getCurrentUser: getCurrentUserMock }));
vi.mock("@/server/repositories/reports", () => ({
  getReportAccessInfo: getReportAccessInfoMock,
  getReportEmailData: getReportEmailDataMock
}));
vi.mock("@/server/scope", () => ({ loadAccessScopes: loadAccessScopesMock }));

async function loadActions() {
  return import("@/server/actions/report-alimtalk");
}

function formData(entries: Record<string, string>) {
  const fd = new FormData();
  for (const [key, value] of Object.entries(entries)) fd.set(key, value);
  return fd;
}

const data = {
  title: "7월 성과",
  clientName: "서울치과",
  contactEmail: null,
  contactPhone: "010-1234-5678",
  reportingMonth: new Date("2026-07-01T00:00:00.000Z"),
  metrics: [],
  notes: null
};

beforeEach(() => {
  vi.clearAllMocks();
  getCurrentUserMock.mockResolvedValue(adminUser({ id: "admin-1" }));
  loadAccessScopesMock.mockResolvedValue([{ adminId: "admin-1", marketerId: null, clientId: null, allMarketers: true, allClients: true }]);
  getReportAccessInfoMock.mockResolvedValue({
    id: "report-1",
    clientId: "client-1",
    authorId: "admin-1",
    status: "APPROVED",
    clientAssignedMarketerId: "admin-1"
  });
  getReportEmailDataMock.mockResolvedValue(data);
  vi.stubEnv("KAKAO_ALIMTALK_API_KEY", "");
  vi.stubEnv("KAKAO_ALIMTALK_SENDER", "");
  vi.stubEnv("KAKAO_ALIMTALK_ENDPOINT", "");
});

afterEach(() => vi.unstubAllEnvs());

describe("sendReportAlimtalkAction", () => {
  it("previews to the client's registered phone (normalized) when unconfigured", async () => {
    const { sendReportAlimtalkAction } = await loadActions();

    const result = await sendReportAlimtalkAction(null, formData({ id: "report-1" }));

    const out = expectOk(result);
    expect(out.sent).toBe(false);
    expect(out.to).toBe("01012345678");
    expect(out.text).toContain("서울치과");
  });

  it("uses an explicit phone override", async () => {
    const { sendReportAlimtalkAction } = await loadActions();

    const result = await sendReportAlimtalkAction(null, formData({ id: "report-1", to: "010-9999-0000" }));

    expect(expectOk(result).to).toBe("01099990000");
  });

  it("rejects an invalid phone", async () => {
    const { sendReportAlimtalkAction } = await loadActions();

    expectFail(
      await sendReportAlimtalkAction(null, formData({ id: "report-1", to: "123" })),
      ErrorCode.VALIDATION_ERROR
    );
  });

  it("fails when there is no recipient number", async () => {
    const { sendReportAlimtalkAction } = await loadActions();
    getReportEmailDataMock.mockResolvedValue({ ...data, contactPhone: null });

    expectFail(await sendReportAlimtalkAction(null, formData({ id: "report-1" })), ErrorCode.VALIDATION_ERROR);
  });
});
