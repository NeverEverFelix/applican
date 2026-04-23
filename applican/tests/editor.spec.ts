import { expect, test } from "@playwright/test";
import { seedAuthenticatedSession } from "./helpers/auth";
import { mockEditorEmptyState } from "./helpers/editorMocks";

test("pro user can open the editor shell and toggle into editor mode", async ({ page }) => {
  await seedAuthenticatedSession(page, {
    email: "playwright-editor@example.com",
    fullName: "Playwright Editor",
    plan: "pro",
  });
  await mockEditorEmptyState(page);

  await page.goto("/app");
  await page.getByRole("button", { name: "Editor" }).click();

  await expect(page.getByText("Generated History")).toBeVisible();
  await expect(page.getByText("No generated resumes yet.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Switch to editor view" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Download .tex file" })).toBeVisible();

  await page.getByRole("button", { name: "Switch to editor view" }).click();

  await expect(page.getByRole("button", { name: "Switch to history view" })).toBeVisible();
  await expect(page.getByTitle("Tailored resume PDF preview")).toBeVisible();
});
