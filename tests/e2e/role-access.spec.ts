import { expect, test } from "@playwright/test";
import { gotoAs } from "./helpers";

test("marketer cannot see staff permissions nav", async ({ page }) => {
  await gotoAs(page, "MARKETER");
  await expect(page.getByRole("link", { name: "업무관리" })).toBeVisible();
  await expect(page.getByRole("link", { name: "직원/권한" })).toHaveCount(0);
});

test("super admin can see staff permissions nav", async ({ page }) => {
  await gotoAs(page, "SUPER_ADMIN");
  await expect(page.getByRole("link", { name: "직원/권한" })).toBeVisible();
});
