import type { Page } from "@playwright/test";

export type DevSessionRole = "SUPER_ADMIN" | "ADMIN" | "MARKETER";

export async function loginAsRole(page: Page, role: DevSessionRole, next = "/dashboard") {
  await page.goto(`/dev/session?role=${role}&next=${encodeURIComponent(next)}`);
}
