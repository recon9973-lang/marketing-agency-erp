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
  return import("@/server/actions/report-email");
}

function formData(entries: Record<string, string>) {
  const fd = new FormData();
  for (const [key, value] of Object.entries(entries)) fd.set(key, value);
  return fd;
}

const emailData = {
  title: "7월 성과",
  clientName: "서울치과",
  contactEmail: "manager@seoul-dental.example",
  reportingMonth: new Date("2026-07-01T00:00:00.000Z"),
  metrics: [{ label: "방문", value: "100" }],
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
  getReportEmailDataMock.mockResolvedValue(emailData);
  // 미연동 → 미리보기 경로(네트워크 없음)
  vi.stubEnv("EMAIL_API_KEY", "");
  vi.stubEnv("EMAIL_FROM", "");
});

afterEach(() => vi.unstubAllEnvs());

describe("sendReportEmailAction", () => {
  it("previews to the client's registered email when unconfigured", async () => {
    const { sendReportEmailAction } = await loadActions();

    const result = await sendReportEmailAction(null, formData({ id: "report-1" }));

    const data = expectOk(result);
    expect(data.sent).toBe(false);
    expect(data.to).toBe("manager@seoul-dental.example");
    expect(data.subject).toContain("서울치과");
  });

  it("uses an explicit recipient override", async () => {
    const { sendReportEmailAction } = await loadActions();

    const result = await sendReportEmailAction(null, formData({ id: "report-1", to: "other@x.com" }));

    expect(expectOk(result).to).toBe("other@x.com");
  });

  it("rejects an invalid email override", async () => {
    const { sendReportEmailAction } = await loadActions();

    expectFail(
      await sendReportEmailAction(null, formData({ id: "report-1", to: "not-an-email" })),
      ErrorCode.VALIDATION_ERROR
    );
  });

  it("fails when there is no recipient at all", async () => {
    const { sendReportEmailAction } = await loadActions();
    getReportEmailDataMock.mockResolvedValue({ ...emailData, contactEmail: null });

    expectFail(await sendReportEmailAction(null, formData({ id: "report-1" })), ErrorCode.VALIDATION_ERROR);
  });

  it("returns NOT_FOUND for a missing report", async () => {
    const { sendReportEmailAction } = await loadActions();
    getReportAccessInfoMock.mockResolvedValue(null);

    expectFail(await sendReportEmailAction(null, formData({ id: "ghost" })), ErrorCode.NOT_FOUND);
  });
});
