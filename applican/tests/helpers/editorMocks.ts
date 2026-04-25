import type { Page } from "@playwright/test";

export async function mockEditorEmptyState(page: Page) {
  await page.route("**/rest/v1/generated_resumes**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify([]),
    });
  });

  await page.route("**/rest/v1/resume_runs**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: "null",
    });
  });
}
