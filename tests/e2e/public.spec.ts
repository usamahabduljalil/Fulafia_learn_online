import { expect, test } from "@playwright/test";

test("public authentication routes are reachable", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "FULAFIA Online Class" })).toBeVisible();
  await page.getByRole("link", { name: "Sign In" }).click();
  await expect(page.getByRole("heading", { name: "Welcome Back" })).toBeVisible();
  await page.getByRole("link", { name: "Forgot password?" }).click();
  await expect(page.getByRole("heading", { name: "Reset password" })).toBeVisible();
});

test("authenticated classroom journey", async ({ page }) => {
  test.skip(!process.env.E2E_STUDENT_EMAIL || !process.env.E2E_STUDENT_PASSWORD, "Requires a seeded Supabase test account");
  await page.goto("/login");
  await page.getByLabel("Email").fill(process.env.E2E_STUDENT_EMAIL!);
  await page.getByLabel("Password").fill(process.env.E2E_STUDENT_PASSWORD!);
  await page.getByRole("button", { name: "Sign In" }).click();
  await expect(page).toHaveURL(/dashboard/);
  await expect(page.getByRole("heading", { name: "My classes" })).toBeVisible();
});
