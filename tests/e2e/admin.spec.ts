import { expect, test } from "@playwright/test";

import { readE2eFixture } from "./support/fixture";
import { login } from "./support/login";

test("administrator access is enforced and the user audit surface loads", async ({ page }) => {
  const fixture = await readE2eFixture();
  await login(page, fixture.users.admin, fixture);
  await page.goto("/admin/users");

  await expect(page.getByRole("heading", { name: "Administrator access" })).toBeVisible();
  await expect(page.getByText("Audited access control")).toBeVisible();
  await expect(page.getByText(fixture.users.primary.email)).toBeVisible();
});
