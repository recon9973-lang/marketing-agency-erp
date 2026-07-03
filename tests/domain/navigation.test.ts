import { describe, expect, it } from "vitest";
import { getNavigationItems } from "@/components/erp/AppShell";
import { Role } from "@/domain/types";

describe("role navigation", () => {
  it("hides staff management from marketers", () => {
    const labels = getNavigationItems(Role.MARKETER).map((item) => item.label);
    expect(labels).toContain("업무관리");
    expect(labels).not.toContain("직원/권한");
  });

  it("shows staff management to super admins", () => {
    const labels = getNavigationItems(Role.SUPER_ADMIN).map((item) => item.label);
    expect(labels).toContain("직원/권한");
  });

  it("shows the shared file vault to every role", () => {
    for (const role of [Role.SUPER_ADMIN, Role.ADMIN, Role.MARKETER]) {
      expect(getNavigationItems(role).map((item) => item.label)).toContain("보관함");
    }
  });
});
