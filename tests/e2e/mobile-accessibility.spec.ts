import { expect, test, type Page } from "@playwright/test";

import { readE2eFixture } from "./support/fixture";
import { login } from "./support/login";

async function expectAccessibleMobilePage(page: Page) {
  await expect(page.locator("main")).toBeVisible();
  const audit = await page.evaluate(() => {
    const interactive = Array.from(document.querySelectorAll("button, input, select, textarea, a[href]"));
    const unnamed = interactive.filter((element) => {
      if (element instanceof HTMLInputElement && element.type === "hidden") return false;
      const id = element.getAttribute("id");
      const label = id ? document.querySelector(`label[for="${CSS.escape(id)}"]`) : null;
      const wrappingLabel = element.closest("label");
      const textCanName = element instanceof HTMLButtonElement || element instanceof HTMLAnchorElement;
      return !element.getAttribute("aria-label") && !element.getAttribute("title") && !label && !wrappingLabel && !(textCanName && (element.textContent ?? "").trim());
    }).map((element) => element.outerHTML.slice(0, 300));
    return { unnamed, overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth };
  });
  expect(audit.unnamed).toEqual([]);
  expect(audit.overflow).toBeLessThanOrEqual(1);
}

test("critical student pages remain labelled and fit a mobile viewport", async ({ page }) => {
  const fixture = await readE2eFixture();
  await login(page, fixture.users.primary, fixture);
  for (const route of ["/dashboard", "/academics", "/tasks", "/planner", "/ai-chat", "/practice", "/notifications"]) {
    await page.goto(route);
    await expectAccessibleMobilePage(page);
  }
});
