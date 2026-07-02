import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const findManyMock = vi.fn();

vi.mock("@/server/db", () => ({
  db: {
    accessScope: {
      findMany: findManyMock
    }
  }
}));

import { adminUser, marketerUser, superAdminUser } from "../helpers/users";
import { clientScope, makeScope, marketerScope } from "../helpers/scopes";

async function loadScopeModule() {
  return import("@/server/scope");
}

describe("loadAccessScopes", () => {
  beforeEach(() => {
    findManyMock.mockReset();
  });

  it("loads admin scopes from the database", async () => {
    const { loadAccessScopes } = await loadScopeModule();
    findManyMock.mockResolvedValue([clientScope("admin-1", "client-1")]);
    const scopes = await loadAccessScopes(adminUser({ id: "admin-1" }));
    expect(findManyMock).toHaveBeenCalledWith(expect.objectContaining({ where: { adminId: "admin-1" } }));
    expect(scopes).toHaveLength(1);
  });

  it("returns empty scopes for non-admin roles without querying", async () => {
    const { loadAccessScopes } = await loadScopeModule();
    expect(await loadAccessScopes(superAdminUser())).toEqual([]);
    expect(await loadAccessScopes(marketerUser())).toEqual([]);
    expect(findManyMock).not.toHaveBeenCalled();
  });
});

describe("buildAccessibleClientWhere", () => {
  let buildAccessibleClientWhere: Awaited<ReturnType<typeof loadScopeModule>>["buildAccessibleClientWhere"];

  beforeAll(async () => {
    ({ buildAccessibleClientWhere } = await loadScopeModule());
  });

  it("returns an unrestricted where for super admins", () => {
    expect(buildAccessibleClientWhere(superAdminUser(), [])).toEqual({});
  });

  it("restricts marketers to their assigned clients", () => {
    expect(buildAccessibleClientWhere(marketerUser({ id: "marketer-1" }), [])).toEqual({
      assignedMarketerId: "marketer-1"
    });
  });

  it("opens all clients when an admin has the allClients scope", () => {
    const user = adminUser();
    expect(buildAccessibleClientWhere(user, [makeScope({ adminId: user.id, allClients: true })])).toEqual({});
  });

  it("builds an OR of client and marketer clauses for scoped admins", () => {
    const user = adminUser();
    const where = buildAccessibleClientWhere(user, [
      clientScope(user.id, "client-1"),
      marketerScope(user.id, "marketer-1")
    ]);
    expect(where).toEqual({
      OR: [{ id: { in: ["client-1"] } }, { assignedMarketerId: { in: ["marketer-1"] } }]
    });
  });

  it("treats allMarketers as any-assigned client access", () => {
    const user = adminUser();
    const where = buildAccessibleClientWhere(user, [makeScope({ adminId: user.id, allMarketers: true })]);
    expect(where).toEqual({ OR: [{ assignedMarketerId: { not: null } }] });
  });

  it("matches no rows when an admin has no usable scope", () => {
    const user = adminUser();
    expect(buildAccessibleClientWhere(user, [])).toEqual({ id: { in: [] } });
  });

  it("ignores scopes that belong to other admins", () => {
    const user = adminUser({ id: "admin-1" });
    const where = buildAccessibleClientWhere(user, [clientScope("admin-2", "client-99")]);
    expect(where).toEqual({ id: { in: [] } });
  });
});
