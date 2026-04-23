import { existsSync } from "node:fs";
import path from "node:path";
import { expect, test, type Page } from "@playwright/test";

const liveEmail = process.env.E2E_LIVE_EMAIL?.trim() ?? "";
const livePassword = process.env.E2E_LIVE_PASSWORD?.trim() ?? "";
const liveResumePathRaw = process.env.E2E_LIVE_RESUME_PATH?.trim() ?? "";
const liveJobDescription =
  process.env.E2E_LIVE_JOB_DESCRIPTION?.trim() ||
  "This frontend engineer role requires React, TypeScript, automated testing, accessibility, performance tuning, product collaboration, and ownership of complex user-facing workflows across a fast-moving engineering team.";

const liveResumePath = liveResumePathRaw
  ? path.isAbsolute(liveResumePathRaw)
    ? liveResumePathRaw
    : path.resolve(process.cwd(), liveResumePathRaw)
  : "";

async function signInWithLiveAccount(page: Page) {
  await page.goto("/login");

  await page.getByPlaceholder("Email").fill(liveEmail);
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByPlaceholder("Password").fill(livePassword);
  await page.getByRole("button", { name: "Continue" }).click();

  await expect(page).toHaveURL(/\/app$/, { timeout: 30_000 });
}

test.describe("live e2e", () => {
  test.skip(!liveEmail || !livePassword, "Set E2E_LIVE_EMAIL and E2E_LIVE_PASSWORD to run live e2e tests.");

  test("real Supabase auth signs a live user into the app shell", async ({ page }) => {
    await signInWithLiveAccount(page);

    await expect(page.getByRole("button", { name: "Open user menu" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Resume Studio" })).toBeVisible();
  });

  test("real resume submission can reach generated results", async ({ page }) => {
    test.skip(!liveResumePath, "Set E2E_LIVE_RESUME_PATH to a real PDF/DOC/DOCX file to run live generation.");
    test.skip(!existsSync(liveResumePath), `Live resume file not found: ${liveResumePath}`);
    test.slow();
    test.setTimeout(240_000);

    await signInWithLiveAccount(page);

    await page.getByPlaceholder("Paste a job description...").fill(liveJobDescription);
    await page.locator('input[type="file"]').setInputFiles(liveResumePath);
    await page.getByRole("button", { name: "Generate Result" }).click();

    await expect(page.getByLabel("Generating your application")).toBeVisible();
    await expect(page.getByRole("button", { name: "New analysis" })).toBeVisible({ timeout: 180_000 });
    await expect(page.getByText("Resume Optimizations")).toBeVisible();
  });
});
