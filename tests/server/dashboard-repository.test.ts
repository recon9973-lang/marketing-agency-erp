import { beforeEach, describe, expect, it, vi } from "vitest";
import { Role } from "@/domain/types";

const clientCountMock = vi.fn();
const workItemFindManyMock = vi.fn();
const billingFindManyMock = vi.fn();
const expenseFindManyMock = vi.fn();
const leaveRequestFindManyMock = vi.fn();
const leavePolicyFindFirstMock = vi.fn();
const accessScopeFindManyMock = vi.fn();

vi.mock("@/server/db", () => ({
  db: {
    client: { count: clientCountMock },
    workItem: { findMany: workItemFindManyMock },
    billingRecord: { findMany: billingFindManyMock },
    expenseRecord: { findMany: expenseFindManyMock },
    leaveRequest: { findMany: leaveRequestFindManyMock },
    leavePolicy: { findFirst: leavePolicyFindFirstMock },
    accessScope: { findMany: accessScopeFindManyMock }
  }
}));

describe("fetchDashboardInput", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    vi.unstubAllEnvs();
    clientCountMock.mockResolvedValue(0);
    workItemFindManyMock.mockResolvedValue([]);
    billingFindManyMock.mockResolvedValue([]);
    expenseFindManyMock.mockResolvedValue([]);
    leaveRequestFindManyMock.mockResolvedValue([]);
    leavePolicyFindFirstMock.mockResolvedValue(null);
    accessScopeFindManyMock.mockResolvedValue([]);
  });

  it("fetches all dashboard records for super admins", async () => {
    const { fetchDashboardInput } = await import("@/server/repositories/dashboard");

    const input = await fetchDashboardInput(
      { id: "root", name: "Root", email: "root@agency.test", role: Role.SUPER_ADMIN, canAccessSettings: true },
      { today: "2026-06-28", timeZone: "Asia/Seoul" }
    );

    expect(workItemFindManyMock).toHaveBeenCalledWith(expect.objectContaining({ where: {} }));
    expect(billingFindManyMock).toHaveBeenCalledWith(expect.objectContaining({ where: {} }));
    expect(expenseFindManyMock).toHaveBeenCalledWith(expect.objectContaining({ where: {} }));
    expect(leaveRequestFindManyMock).toHaveBeenCalledWith(expect.objectContaining({ where: {} }));
    expect(clientCountMock).toHaveBeenCalledWith({ where: {} });
    expect(input.today).toBe("2026-06-28");
  });

  it("scopes admin dashboard records to assigned clients and marketers", async () => {
    accessScopeFindManyMock.mockResolvedValue([
      { clientId: "client-1", marketerId: null, allClients: false, allMarketers: false },
      { clientId: null, marketerId: "marketer-1", allClients: false, allMarketers: false }
    ]);
    const { fetchDashboardInput } = await import("@/server/repositories/dashboard");

    await fetchDashboardInput(
      { id: "admin-1", name: "Admin", email: "admin@agency.test", role: Role.ADMIN, canAccessSettings: true },
      { today: "2026-06-28", timeZone: "Asia/Seoul" }
    );

    expect(workItemFindManyMock).toHaveBeenCalledWith(expect.objectContaining({ where: { OR: [{ clientId: { in: ["client-1"] } }, { ownerId: { in: ["marketer-1"] } }] } }));
    expect(billingFindManyMock).toHaveBeenCalledWith(expect.objectContaining({ where: { OR: [{ clientId: { in: ["client-1"] } }, { client: { assignedMarketerId: { in: ["marketer-1"] } } }] } }));
    expect(expenseFindManyMock).toHaveBeenCalledWith(expect.objectContaining({ where: { OR: [{ clientId: { in: ["client-1"] } }, { client: { assignedMarketerId: { in: ["marketer-1"] } } }] } }));
    expect(leaveRequestFindManyMock).toHaveBeenCalledWith(expect.objectContaining({ where: { requesterId: { in: ["marketer-1"] } } }));
  });

  it("shows client-owned expenses for admins with marketer scopes", async () => {
    accessScopeFindManyMock.mockResolvedValue([
      { clientId: null, marketerId: "marketer-1", allClients: false, allMarketers: false }
    ]);
    const { fetchDashboardInput } = await import("@/server/repositories/dashboard");

    await fetchDashboardInput(
      { id: "admin-1", name: "Admin", email: "admin@agency.test", role: Role.ADMIN, canAccessSettings: true },
      { today: "2026-06-28", timeZone: "Asia/Seoul" }
    );

    expect(expenseFindManyMock).toHaveBeenCalledWith(expect.objectContaining({ where: { OR: [{ client: { assignedMarketerId: { in: ["marketer-1"] } } }] } }));
  });

  it("uses the dashboard business year for leave balance", async () => {
    const { fetchDashboardInput } = await import("@/server/repositories/dashboard");

    await fetchDashboardInput(
      { id: "marketer-1", name: "Marketer", email: "marketer@agency.test", role: Role.MARKETER, canAccessSettings: false },
      { today: "2026-06-28", timeZone: "Asia/Seoul" }
    );

    expect(leavePolicyFindFirstMock).toHaveBeenCalledWith(expect.objectContaining({ where: { userId: "marketer-1", year: 2026 } }));
  });

  it("scopes marketer dashboard records to the marketer", async () => {
    const { fetchDashboardInput } = await import("@/server/repositories/dashboard");

    await fetchDashboardInput(
      { id: "marketer-1", name: "Marketer", email: "marketer@agency.test", role: Role.MARKETER, canAccessSettings: false },
      { today: "2026-06-28", timeZone: "Asia/Seoul" }
    );

    expect(workItemFindManyMock).toHaveBeenCalledWith(expect.objectContaining({ where: { ownerId: "marketer-1" } }));
    expect(clientCountMock).toHaveBeenCalledWith({ where: { assignedMarketerId: "marketer-1" } });
    expect(leaveRequestFindManyMock).toHaveBeenCalledWith(expect.objectContaining({ where: { requesterId: "marketer-1" } }));
  });

  it("returns empty dashboard input for dev sessions when the database is unavailable", async () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("ALLOW_DEV_SESSION", "true");
    clientCountMock.mockRejectedValue(new Error("DATABASE_URL missing"));
    const { fetchDashboardInput } = await import("@/server/repositories/dashboard");

    const input = await fetchDashboardInput(
      { id: "dev-user", name: "Local Preview", email: "dev@marketing-erp.local", role: Role.MARKETER, canAccessSettings: false },
      { today: "2026-06-30", timeZone: "Asia/Seoul" }
    );

    expect(input).toEqual({
      today: "2026-06-30",
      timeZone: "Asia/Seoul",
      assignedClientCount: 0,
      leaveBalanceDays: 0,
      workItems: [],
      billings: [],
      expenses: [],
      leaveRequests: []
    });
  });
});
