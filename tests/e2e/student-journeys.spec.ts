import { expect, test } from "@playwright/test";

import { readE2eFixture } from "./support/fixture";
import { login } from "./support/login";

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
      const availableSlot = slot.locator('option[value="LEVEL_100|First Semester"]');
      if (await availableSlot.count()) {
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

    await page.getByPlaceholder("Assignment title").fill(taskTitle);
    await page.getByLabel("Task priority").selectOption("HIGH");
    await page.getByRole("button", { name: "Save task" }).click();
    await expect(page.getByText(taskTitle)).toBeVisible();

    const task = page.locator("article").filter({ hasText: taskTitle });
    await task.getByRole("button", { name: "DONE" }).click();
    await expect(task.getByText("DONE", { exact: true })).toBeVisible();
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
    await login(page, fixture.users.primary, fixture);
    await page.goto(`/practice/${fixture.diagnosticQuizId}`);

    const answers = page.locator('fieldset input[type="radio"][value="A"]');
    await expect(answers).toHaveCount(4);
    for (let index = 0; index < 4; index += 1) await answers.nth(index).check();
    await page.getByRole("button", { name: "Submit diagnostic" }).click();

    await expect(page.getByText("Score: 4/4")).toBeVisible();
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
    const notification = page.locator("article").filter({ hasText: fixture.notificationTitle });
    const markRead = notification.getByRole("button", { name: "Mark read" });
    if (await markRead.isVisible()) await markRead.click();
    await expect(notification.getByRole("button", { name: "Mark unread" })).toBeVisible();
  });
});
