import { describe, expect, it } from "vitest";
import { filterClientsForUser } from "@/server/repositories/clients";
import { Role } from "@/domain/types";

const clients = [
  { id: "client-1", assignedMarketerId: "marketer-1", name: "A 병원" },
  { id: "client-2", assignedMarketerId: "marketer-2", name: "B 학원" }
];

describe("client filtering", () => {
  it("shows only assigned marketer clients to marketers", () => {
    const result = filterClientsForUser({ id: "marketer-1", role: Role.MARKETER }, clients, []);
    expect(result.map((client) => client.id)).toEqual(["client-1"]);
  });

  it("shows marketer-scoped clients to admins", () => {
    const result = filterClientsForUser({ id: "admin-1", role: Role.ADMIN }, clients, [
      { adminId: "admin-1", marketerId: "marketer-1", clientId: null, allMarketers: false, allClients: false }
    ]);

    expect(result.map((client) => client.id)).toEqual(["client-1"]);
  });

  it("does not treat all-marketers scope as unassigned client access", () => {
    const result = filterClientsForUser(
      { id: "admin-1", role: Role.ADMIN },
      [...clients, { id: "client-3", assignedMarketerId: null, name: "미배정 업체" }],
      [{ adminId: "admin-1", marketerId: null, clientId: null, allMarketers: true, allClients: false }]
    );

    expect(result.map((client) => client.id)).toEqual(["client-1", "client-2"]);
  });
});
