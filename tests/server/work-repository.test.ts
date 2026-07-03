import { beforeEach, describe, expect, it, vi } from "vitest";
import { Role, WorkCategory, WorkStatus } from "@/domain/types";

const workItemFindManyMock = vi.fn();
const accessScopeFindManyMock = vi.fn();

vi.mock("@/server/db", () => ({
  db: {
    workItem: { findMany: workItemFindManyMock },
    accessScope: { findMany: accessScopeFindManyMock }
  }
}));

describe("fetchWorkItemsForUser", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    workItemFindManyMock.mockResolvedValue([]);
    accessScopeFindManyMock.mockResolvedValue([]);
  });

  it("scopes admin work items to assigned clients and marketers", async () => {
    accessScopeFindManyMock.mockResolvedValue([
      { clientId: "client-1", marketerId: null, allClients: false, allMarketers: false },
      { clientId: null, marketerId: "marketer-1", allClients: false, allMarketers: false }
    ]);
    const { fetchWorkItemsForUser } = await import("@/server/repositories/work");

    await fetchWorkItemsForUser({
      id: "admin-1",
      name: "Admin",
      email: "admin@agency.test",
      role: Role.ADMIN,
      canAccessSettings: false
    });

    expect(workItemFindManyMock).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { OR: [{ clientId: { in: ["client-1"] } }, { ownerId: { in: ["marketer-1"] } }] }
      })
    );
  });

  it("combines marketer scope with selected status and category filters", async () => {
    const { fetchWorkItemsForUser } = await import("@/server/repositories/work");

    await fetchWorkItemsForUser(
      {
        id: "marketer-1",
        name: "Marketer",
        email: "marketer@agency.test",
        role: Role.MARKETER,
        canAccessSettings: false
      },
      { status: WorkStatus.IN_PROGRESS, category: WorkCategory.SNS_MANAGEMENT }
    );

    expect(workItemFindManyMock).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          AND: [{ ownerId: "marketer-1" }, { status: WorkStatus.IN_PROGRESS, category: WorkCategory.SNS_MANAGEMENT }]
        }
      })
    );
  });
});
