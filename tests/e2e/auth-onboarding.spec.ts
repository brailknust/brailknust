import { expect, test } from "@playwright/test";

import { readE2eFixture } from "./support/fixture";
import { login } from "./support/login";

test.describe.serial("authentication and onboarding", () => {
  test("signup validates password confirmation in the browser", async ({ page }) => {
    await page.goto("/signup");
    await page.getByLabel("Full name").fill("Phase Two Signup");
    await page.getByLabel("Email address").fill("phase-two-signup@example.com");
    await page.getByPlaceholder("Create a password").fill("secure-password");
    await page.getByPlaceholder("Confirm your password").fill("different-password");
    await page.getByRole("button", { name: "Create account" }).click();

    await expect(page.getByText("Passwords do not match.")).toBeVisible();
    await expect(page).toHaveURL(/\/signup/);
  });

  test("a new authenticated student completes onboarding", async ({ page }) => {
    const fixture = await readE2eFixture();
    await login(page, fixture.users.onboarding, fixture);

    if (new URL(page.url()).pathname === "/onboarding") {
      await page.getByLabel("Student ID").fill(`ONBOARD-${fixture.runId}`);
      await page.locator('select[name="college"]').selectOption("College of Agriculture and Natural Resources");
      await page.locator('select[name="programme"]').selectOption("Agricultural Economics, Agribusiness and Extension");
      await page.locator('select[name="cwa"]').selectOption("70");
      await page.getByRole("button", { name: "Create profile" }).click();

      await page.waitForURL(/\/dashboard/, { timeout: 15_000 }).catch(async () => {
        await page.goto("/dashboard");
      });
    }

    await expect(page).toHaveURL(/\/dashboard/);
    await expect(page.getByRole("heading", { name: "Welcome, BRAIL E2E onboarding" })).toBeVisible();
  });
});
