import { describe, expect, it, vi } from "vitest";

// AppShell은 서버 액션·인증 체인(→ next-auth → next/server)을 전이 임포트한다.
// getNavigationItems는 순수 함수이므로, 무거운/서버 의존 임포트를 목으로 끊어 테스트 가능하게 한다.
vi.mock("@/server/actions/favorites", () => ({ toggleUserFavorite: vi.fn() }));
vi.mock("@/server/actions/logout", () => ({ logout: vi.fn() }));
vi.mock("@/components/collab/NotificationBell", () => ({ NotificationBell: () => null }));
vi.mock("@/components/search/CommandPalette", () => ({ CommandPalette: () => null }));
vi.mock("@/components/search/ErpSearch", () => ({ ErpSearch: () => null }));

import { getNavigationItems } from "@/components/erp/AppShell";
import { Role } from "@/domain/types";

describe("role navigation", () => {
  it("hides staff management from marketers", () => {
    const labels = getNavigationItems(Role.MARKETER).map((item) => item.label);
    expect(labels).toContain("업무관리");
    expect(labels).not.toContain("인사관리");
  });

  it("shows staff management to super admins", () => {
    const labels = getNavigationItems(Role.SUPER_ADMIN).map((item) => item.label);
    expect(labels).toContain("인사관리");
  });
});
