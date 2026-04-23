import { expect, test } from "@playwright/test";
import { seedAuthenticatedSession } from "./helpers/auth";

test("authenticated user visiting root is redirected into the app shell", async ({ page }) => {
  await seedAuthenticatedSession(page, {
    fullName: "Playwright User",
    plan: "pro",
  });

  await page.goto("/");

  await expect(page).toHaveURL(/\/app$/);
  await expect(page.getByRole("button", { name: "Open user menu" })).toBeVisible();
  await expect(page.getByText("Playwright User")).toBeVisible();
  await expect(page.getByRole("button", { name: "Resume Studio" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Application Tracker" })).toBeVisible();
});

test("authenticated user can open profile from the user menu and return to the studio", async ({ page }) => {
  await seedAuthenticatedSession(page, {
    email: "playwright-profile@example.com",
    fullName: "Playwright Profile",
    plan: "free",
  });

  await page.goto("/app");

  await page.getByRole("button", { name: "Open user menu" }).click();
  await expect(page.getByRole("menuitem", { name: "Profile" })).toBeVisible();

  await page.getByRole("menuitem", { name: "Profile" }).click();

  await expect(page.getByLabel("First name")).toHaveValue("Playwright");
  await expect(page.getByLabel("Last name")).toHaveValue("Profile");
  await expect(page.getByLabel("Email address")).toHaveValue("playwright-profile@example.com");
  await expect(page.getByLabel("Professional summary")).toBeVisible();
  await expect(page.getByRole("button", { name: "Close profile and return to Resume Studio" })).toBeVisible();

  await page.getByRole("button", { name: "Close profile and return to Resume Studio" }).click();

  await expect(page.getByRole("button", { name: "Resume Studio" })).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByLabel("First name")).toHaveCount(0);
});

test("free plan user is blocked from locked views and sees the upgrade modal", async ({ page }) => {
  await seedAuthenticatedSession(page, {
    email: "playwright-free@example.com",
    fullName: "Playwright Free",
    plan: "free",
  });

  await page.goto("/app");

  await page.getByRole("button", { name: "Resources" }).click();

  await expect(page.getByLabel("Upgrade modal")).toBeVisible();
  await expect(
    page.getByText("You must be subscribed to Applican Pro to access this resource"),
  ).toBeVisible();
  await expect(
    page.locator('button[aria-pressed="true"]').filter({ hasText: "Resume Studio" }),
  ).toBeVisible();
});
