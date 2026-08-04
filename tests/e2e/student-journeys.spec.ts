import { expect, test, type Page } from "@playwright/test";

import { readE2eFixture } from "./support/fixture";
import { login } from "./support/login";

async function submitServerAction(page: Page, pathname: string, submit: () => Promise<void>) {
  const response = page.waitForResponse((candidate) =>
    candidate.request().method() === "POST" && new URL(candidate.url()).pathname === pathname,
  );

  await submit();
  const completedResponse = await response;
  const failure = await completedResponse.finished();
  if (failure) throw failure;
}

test.describe.serial("critical student journeys", () => {
  test("semesters and courses load within the active academic workspace", async ({ page }) => {
    const fixture = await readE2eFixture();
    await login(page, fixture.users.primary, fixture);
    await page.goto("/academics");

    await expect(page.getByRole("heading", { name: "Academic semesters" })).toBeVisible();
    await page.goto(`/academics/semesters/${fixture.primarySemesterId}`);
    await expect(page.getByRole("article").filter({ hasText: fixture.courseName })).toBeVisible();
    await page.goto("/academics");
    const semesterHeading = page.getByRole("heading", { name: "Level 100 - First Semester", exact: true });
    if (!(await semesterHeading.isVisible())) {
      const addSemester = page.locator("form").filter({ has: page.getByRole("heading", { name: "Add semester" }) });
      const slot = addSemester.locator('select[name="slot"]');
      const slotAvailable = await slot.evaluate((element) =>
        Array.from((element as HTMLSelectElement).options).some(
          (option) => option.value === "LEVEL_100|First Semester",
        ),
      );
      if (slotAvailable) {
        await slot.selectOption("LEVEL_100|First Semester");
        await addSemester.getByRole("button", { name: "Save semester" }).click();
      } else {
        await page.reload();
      }
    }
    await expect(semesterHeading).toBeVisible();
  });

  test("tasks can be created and completed", async ({ page }) => {
    const fixture = await readE2eFixture();
    const taskTitle = `Phase 2 task ${fixture.runId}`;
    await login(page, fixture.users.primary, fixture);
    await page.goto("/tasks");

    let task = page.locator("article").filter({ hasText: taskTitle }).first();
    if (!(await task.isVisible())) {
      await page.getByPlaceholder("Assignment title").fill(taskTitle);
      await page.getByLabel("Task priority").selectOption("HIGH");
      await submitServerAction(page, "/tasks", () =>
        page.getByRole("button", { name: "Save task" }).click(),
      );
      await page.goto("/tasks");
      task = page.locator("article").filter({ hasText: taskTitle }).first();
    }
    await expect(task).toBeVisible();

    let doneBadge = task.locator("span").filter({ hasText: /^DONE$/ });
    if (!(await doneBadge.isVisible())) {
      await submitServerAction(page, "/tasks", () =>
        task.getByRole("button", { name: "DONE" }).click(),
      );
      await page.goto("/tasks");
      task = page.locator("article").filter({ hasText: taskTitle }).first();
      doneBadge = task.locator("span").filter({ hasText: /^DONE$/ });
    }
    await expect(doneBadge).toBeVisible();
  });

  test("planner creates a plan and a manual session", async ({ page }) => {
    const fixture = await readE2eFixture();
    const planTitle = `Phase 2 plan ${fixture.runId}`;
    const sessionTitle = `Queue revision ${fixture.runId}`;
    await login(page, fixture.users.primary, fixture);
    await page.goto("/planner");

    await page.getByPlaceholder("e.g. Week 3 revision plan").fill(planTitle);
    await page.getByRole("button", { name: "Save plan" }).click();
    await expect(page.getByText(planTitle)).toBeVisible();

    await page.getByText("Add manual study session").click();
    const manualSession = page.getByRole("group").filter({ hasText: "Add manual study session" });
    await manualSession.getByLabel("Description").fill(sessionTitle);
    await manualSession.locator('select[name="courseId"]').selectOption(fixture.courseId);
    await manualSession.getByRole("button", { name: "Add session" }).click();
    await expect(page.locator("#study-timetable").getByText(sessionTitle)).toBeVisible();
  });

  test("private material is uploaded into the selected AI course workspace", async ({ page }) => {
    const fixture = await readE2eFixture();
    await login(page, fixture.users.primary, fixture);
    await page.goto("/ai-chat");

    await expect(page.getByRole("heading", { name: `Ask BRAIL about ${fixture.courseName}` })).toBeVisible();
    await page.getByRole("button", { name: "Attach material" }).click();
    await page.getByPlaceholder("Material title").fill(`Phase 2 upload ${fixture.runId}`);
    await page.getByPlaceholder("Topic (optional, e.g. Power cables)").fill("Queue fundamentals");
    await page.getByLabel("Choose file").setInputFiles({
      name: "phase-two-notes.txt",
      mimeType: "text/plain",
      buffer: Buffer.from("Queue operations include enqueue and dequeue. A queue uses first-in first-out ordering for every stored item."),
    });
    await page.getByRole("button", { name: "Upload for this chat" }).click();

    await expect(page.getByText("File processed. BRAIL can now use it in this course chat.")).toBeVisible();
  });

  test("a material-grounded diagnostic can be completed", async ({ page }) => {
    const fixture = await readE2eFixture();
    const quizPath = `/practice/${fixture.diagnosticQuizId}`;
    await login(page, fixture.users.primary, fixture);
    await page.goto(quizPath);

    await expect(page.getByRole("link", { name: "Back to practice" })).toBeVisible();
    const score = page.getByText("Score: 4/4");
    if (!(await score.isVisible())) {
      const answers = page.locator('fieldset input[type="radio"][value="A"]');
      await expect(answers).toHaveCount(4);
      for (let index = 0; index < 4; index += 1) await answers.nth(index).check();
      await submitServerAction(page, quizPath, () =>
        page.getByRole("button", { name: "Submit diagnostic" }).click(),
      );
      await page.goto(quizPath);
    }

    await expect(score).toBeVisible();
  });

  test("peer Q&A, groups, and notification state changes work", async ({ page }) => {
    const fixture = await readE2eFixture();
    const answer = `Phase 2 answer ${fixture.runId}: explain enqueue, dequeue, and FIFO with a short example.`;
    await login(page, fixture.users.primary, fixture);
    await page.goto("/peers?view=qa");

    const question = page.locator("article").filter({ hasText: fixture.peerQuestionTitle });
    const postedAnswer = question.getByRole("paragraph").filter({ hasText: answer });
    if ((await postedAnswer.count()) === 0) {
      await question.getByLabel("Add answer").fill(answer);
      await question.getByRole("button", { name: "Post answer" }).click();
    }
    await expect(postedAnswer).toHaveCount(1);

    await page.goto("/peers?view=groups");
    const joinGroup = page.getByRole("button", { name: "Join group" });
    if (await joinGroup.isVisible()) await joinGroup.click();
    await expect(page.getByText("Joined", { exact: true })).toBeVisible();

    await page.goto("/notifications");
    let notification = page.locator("article").filter({ hasText: fixture.notificationTitle });
    await expect(notification).toBeVisible();
    let markUnread = notification.getByRole("button", { name: "Mark unread" });
    if (!(await markUnread.isVisible())) {
      const markRead = notification.getByRole("button", { name: "Mark read" });
      await expect(markRead).toBeVisible();
      await submitServerAction(page, "/notifications", () => markRead.click());
      await page.goto("/notifications");
      notification = page.locator("article").filter({ hasText: fixture.notificationTitle });
      markUnread = notification.getByRole("button", { name: "Mark unread" });
    }
    await expect(markUnread).toBeVisible();
  });
});
