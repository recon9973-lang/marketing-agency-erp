import { beforeEach, describe, expect, it, vi } from "vitest";

const wm = { findMany: vi.fn() };
const cp = { findMany: vi.fn() };
const lead = { findMany: vi.fn() };
const conn = { findMany: vi.fn() };
const contract = { findMany: vi.fn() };
const notif = { findFirst: vi.fn(), create: vi.fn() };

vi.mock("@/server/db", () => ({
  db: {
    workItem: wm,
    contentPlan: cp,
    lead: lead,
    channelConnection: conn,
    contract: contract,
    notification: notif,
  },
}));
vi.mock("@/server/repositories/dashboard-extras", () => ({ businessDaysBetween: () => 0 }));

describe("runDailyAlerts — 권한/계약 스위프(④⑤)", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    wm.findMany.mockResolvedValue([]);
    cp.findMany.mockResolvedValue([]);
    lead.findMany.mockResolvedValue([]);
    conn.findMany.mockResolvedValue([]);
    contract.findMany.mockResolvedValue([]);
    notif.findFirst.mockResolvedValue(null);
    notif.create.mockResolvedValue({});
  });

  it("연동 오류 권한은 CREDENTIAL_ALERT를 발송한다", async () => {
    conn.findMany.mockResolvedValue([
      { id: "cc1", provider: "GOOGLE", status: "ERROR", expiresAt: null, client: { id: "c1", name: "베스트치과", assignedMarketerId: "u1" } },
    ]);
    const { runDailyAlerts } = await import("@/server/jobs/daily-alerts");
    const r = await runDailyAlerts(new Date("2026-07-13T09:00:00Z"));
    expect(r.credentialAlert).toBe(1);
    expect(notif.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ type: "CREDENTIAL_ALERT", userId: "u1", targetType: "ChannelConnection" }) }),
    );
  });

  it("계약 만료 D-30 이내는 CONTRACT_RENEWAL_DUE를 발송한다", async () => {
    contract.findMany.mockResolvedValue([
      { id: "ct1", endDate: new Date("2026-07-23T00:00:00Z"), client: { id: "c1", name: "베스트치과", assignedMarketerId: "u1" } },
    ]);
    const { runDailyAlerts } = await import("@/server/jobs/daily-alerts");
    const r = await runDailyAlerts(new Date("2026-07-13T09:00:00Z"));
    expect(r.contractRenewal).toBe(1);
    expect(notif.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ type: "CONTRACT_RENEWAL_DUE", userId: "u1", targetType: "Contract" }) }),
    );
  });

  it("담당 마케터가 없으면 발송하지 않는다", async () => {
    conn.findMany.mockResolvedValue([
      { id: "cc1", provider: "GOOGLE", status: "ERROR", expiresAt: null, client: { id: "c1", name: "X", assignedMarketerId: null } },
    ]);
    const { runDailyAlerts } = await import("@/server/jobs/daily-alerts");
    const r = await runDailyAlerts(new Date("2026-07-13T09:00:00Z"));
    expect(r.credentialAlert).toBe(0);
    expect(notif.create).not.toHaveBeenCalled();
  });

  it("이미 오늘 보냈으면 중복 발송하지 않는다(멱등)", async () => {
    conn.findMany.mockResolvedValue([
      { id: "cc1", provider: "GOOGLE", status: "ERROR", expiresAt: null, client: { id: "c1", name: "X", assignedMarketerId: "u1" } },
    ]);
    notif.findFirst.mockResolvedValue({ id: "existing" });
    const { runDailyAlerts } = await import("@/server/jobs/daily-alerts");
    const r = await runDailyAlerts(new Date("2026-07-13T09:00:00Z"));
    expect(r.credentialAlert).toBe(0);
    expect(notif.create).not.toHaveBeenCalled();
  });
});
