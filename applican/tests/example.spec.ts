import { test, expect } from '@playwright/test';

test('login page renders expected entry points', async ({ page }) => {
  await page.goto('/login');

  await expect(page.getByText('Welcome Back')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Continue' })).toBeDisabled();
  await expect(page.getByRole('button', { name: /Sign in with Google/i })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Sign up' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Forgot password?' })).toBeVisible();
});

test('login flow advances to password step for a valid email', async ({ page }) => {
  await page.goto('/login');

  await page.getByPlaceholder('Email').fill('person@example.com');
  await page.getByRole('button', { name: 'Continue' }).click();

  await expect(page.getByPlaceholder('Password')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Change email' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Forgot password?' })).toHaveCount(0);
});
