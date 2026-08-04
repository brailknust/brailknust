import { expect, type Page } from "@playwright/test";

import type { E2eFixture, TestIdentity } from "./fixture";

export async function login(page: Page, identity: TestIdentity, fixture: E2eFixture) {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    await page.goto("/login");
    await page.getByLabel("Email address").fill(identity.email);
    await page.getByPlaceholder("Enter your password").fill(fixture.password);
    await page.getByRole("button", { name: "Login" }).click();
    await expect.poll(async () => {
      if (new URL(page.url()).pathname !== "/login") return "authenticated";
      if (await page.getByTestId("auth-error").isVisible()) return "retry";
      return "pending";
    }, { timeout: 30_000 }).not.toBe("pending");
    if (new URL(page.url()).pathname !== "/login") return;
    if (attempt < 2) await page.waitForTimeout(1_000);
  }

  await expect(page).not.toHaveURL(/\/login/);
}
