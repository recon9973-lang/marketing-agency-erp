import { expect, test } from "@playwright/test";

test("marketer cannot see staff permissions nav", async ({ page }) => {
  await page.goto("/dev/session?role=MARKETER&next=/dashboard");
  await expect(page.getByRole("link", { name: "업무관리" })).toBeVisible();
  await expect(page.getByRole("link", { name: "직원/권한" })).toHaveCount(0);
});

test("super admin can see staff permissions nav", async ({ page }) => {
  await page.goto("/dev/session?role=SUPER_ADMIN&next=/dashboard");
  await expect(page.getByRole("link", { name: "직원/권한" })).toBeVisible();
});
