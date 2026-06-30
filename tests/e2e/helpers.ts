import type { Page } from "@playwright/test";

export type DevRole = "SUPER_ADMIN" | "ADMIN" | "MARKETER";

/**
 * dev session으로 특정 역할 사용자처럼 페이지를 연다 (V2 §1 e2e 인프라).
 * `ALLOW_DEV_SESSION=true`일 때만 동작한다.
 */
export async function gotoAs(page: Page, role: DevRole, next = "/dashboard") {
  await page.goto(`/dev/session?role=${role}&next=${encodeURIComponent(next)}`);
}
