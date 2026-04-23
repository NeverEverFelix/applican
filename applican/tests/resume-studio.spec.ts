import { expect, test } from "@playwright/test";
import { seedAuthenticatedSession } from "./helpers/auth";
import { mockResumeRun } from "./helpers/resumeRunMocks";

test("resume studio only enables generation after a valid job description and resume upload", async ({ page }) => {
  await seedAuthenticatedSession(page, {
    email: "playwright-studio@example.com",
    fullName: "Playwright Studio",
    plan: "pro",
  });

  await page.goto("/app");

  const generateButton = page.getByRole("button", { name: "Generate Result" });
  const jobDescriptionInput = page.getByPlaceholder("Paste a job description...");
  const fileInput = page.locator('input[type="file"]');
  const validJobDescription =
    "This senior frontend engineer role requires deep React, TypeScript, design systems, testing, accessibility, cross-functional collaboration, product thinking, and measurable delivery across complex user-facing workflows in a fast-moving team environment.";

  await expect(generateButton).toBeDisabled();

  await jobDescriptionInput.fill(validJobDescription);
  await expect(generateButton).toBeDisabled();

  await fileInput.setInputFiles({
    name: "resume.pdf",
    mimeType: "application/pdf",
    buffer: Buffer.from("%PDF-1.4\n% Playwright test resume\n"),
  });

  await expect(page.getByLabel("Replace uploaded resume resume.pdf")).toBeVisible();
  await expect(generateButton).toBeEnabled();
});

test("resume studio rejects unsupported resume files and keeps generation disabled", async ({ page }) => {
  await seedAuthenticatedSession(page, {
    email: "playwright-invalid-file@example.com",
    fullName: "Playwright Invalid File",
    plan: "pro",
  });

  await page.goto("/app");

  const generateButton = page.getByRole("button", { name: "Generate Result" });
  const fileInput = page.locator('input[type="file"]');

  await fileInput.setInputFiles({
    name: "resume.txt",
    mimeType: "text/plain",
    buffer: Buffer.from("plain text resume"),
  });

  await expect(
    page.getByText("Please upload a valid resume file (.pdf, .doc, or .docx)."),
  ).toBeVisible();
  await expect(page.getByLabel("Upload resume")).toBeVisible();
  await expect(generateButton).toBeDisabled();
});

test("resume studio shows validation for a short job description and keeps generation disabled", async ({ page }) => {
  await seedAuthenticatedSession(page, {
    email: "playwright-short-job@example.com",
    fullName: "Playwright Short Job",
    plan: "pro",
  });

  await page.goto("/app");

  const generateButton = page.getByRole("button", { name: "Generate Result" });
  const jobDescriptionInput = page.getByPlaceholder("Paste a job description...");

  await jobDescriptionInput.fill("Short job description");

  await expect(
    page.getByText("Job description should be longer than 200 characters."),
  ).toBeVisible();
  await expect(generateButton).toBeDisabled();
});

test("resume studio shows retryable generation error state from mocked backend responses", async ({ page }) => {
  await seedAuthenticatedSession(page, {
    email: "playwright-mocked-run@example.com",
    fullName: "Playwright Mocked Run",
    plan: "pro",
  });
  await mockResumeRun(page, {
    email: "playwright-mocked-run@example.com",
    fullName: "Playwright Mocked Run",
    mode: "retryable_failure",
  });

  await page.goto("/app");

  await page
    .getByPlaceholder("Paste a job description...")
    .fill(
      "This frontend platform role requires React, TypeScript, testing discipline, accessibility, design system stewardship, product collaboration, release ownership, and clear communication across a fast-moving engineering organization with complex UI workflows.",
    );
  await page.locator('input[type="file"]').setInputFiles({
    name: "resume.pdf",
    mimeType: "application/pdf",
    buffer: Buffer.from("%PDF-1.4\n% Playwright mocked generation resume\n"),
  });

  await page.getByRole("button", { name: "Generate Result" }).click();

  await expect(page.getByLabel("Generating your application")).toBeVisible();
  await expect(page.getByRole("button", { name: "TRY AGAIN" })).toBeVisible();
  await expect(page.getByText(/Your draft is still saved/)).toBeVisible();
});

test("resume studio renders mocked generated results after a successful run", async ({ page }) => {
  await seedAuthenticatedSession(page, {
    email: "playwright-mocked-success@example.com",
    fullName: "Playwright Mocked Success",
    plan: "pro",
  });
  await mockResumeRun(page, {
    email: "playwright-mocked-success@example.com",
    fullName: "Playwright Mocked Success",
    mode: "success",
  });

  await page.goto("/app");

  await page
    .getByPlaceholder("Paste a job description...")
    .fill(
      "This frontend engineer role requires React, TypeScript, testing, accessibility, performance tuning, collaboration with design, and ownership of complex product interfaces across a fast-moving engineering organization.",
    );
  await page.locator('input[type="file"]').setInputFiles({
    name: "resume.pdf",
    mimeType: "application/pdf",
    buffer: Buffer.from("%PDF-1.4\n% Playwright mocked success resume\n"),
  });

  await page.getByRole("button", { name: "Generate Result" }).click();

  await expect(page.getByLabel("Generating your application")).toBeVisible();
  await expect(page.getByText("Analyzing Complete")).toBeVisible({ timeout: 6000 });
  await expect(page.getByRole("button", { name: "New analysis" })).toBeVisible({ timeout: 6000 });
  await expect(page.getByRole("heading", { name: /Acme\s*-\s*FrontendEngineer/i })).toBeVisible();
  await expect(page.getByText("91% Match")).toBeVisible();
  await expect(page.getByText(/Strong React and TypeScript background/)).toBeVisible();
  await expect(page.getByText(/Needs more explicit accessibility metrics/)).toBeVisible();
});

test("resume studio can recover from a retryable failure after clicking TRY AGAIN", async ({ page }) => {
  await seedAuthenticatedSession(page, {
    email: "playwright-retry-success@example.com",
    fullName: "Playwright Retry Success",
    plan: "pro",
  });
  await mockResumeRun(page, {
    email: "playwright-retry-success@example.com",
    fullName: "Playwright Retry Success",
    mode: "retry_then_success",
  });

  await page.goto("/app");

  await page
    .getByPlaceholder("Paste a job description...")
    .fill(
      "This frontend platform role requires React, TypeScript, testing, accessibility, performance optimization, component library ownership, and clear communication across a product-focused engineering team.",
    );
  await page.locator('input[type="file"]').setInputFiles({
    name: "resume.pdf",
    mimeType: "application/pdf",
    buffer: Buffer.from("%PDF-1.4\n% Playwright retry success resume\n"),
  });

  await page.getByRole("button", { name: "Generate Result" }).click();

  await expect(page.getByRole("button", { name: "TRY AGAIN" })).toBeVisible();
  await page.getByRole("button", { name: "TRY AGAIN" }).click();

  await expect(page.getByLabel("Generating your application")).toBeVisible();
  await expect(page.getByRole("button", { name: "New analysis" })).toBeVisible({ timeout: 6000 });
  await expect(page.getByRole("heading", { name: /Acme\s*-\s*FrontendEngineer/i })).toBeVisible();
  await expect(page.getByText("91% Match")).toBeVisible();
});
