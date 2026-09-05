import { expect, test } from '@playwright/test';

// Starts from a clean slate rather than the shared authenticated storage
// state — this spec is the one place the sign-in/out UI flow itself is
// exercised (docs/08-testing-and-ci.md).
test.use({ storageState: { cookies: [], origins: [] } });

test('sign in, land on applications, sign out, redirected to login', async ({ page }) => {
  await page.goto('/login');
  await page.getByLabel(/email/i).fill('test@example.com');
  await page.getByLabel(/password/i).fill('password123');
  // Scoped to the form: the segmented mode toggle also has a "Sign in"
  // button, so an unscoped locator matches both.
  await page.getByTestId('credentials-form').getByRole('button', { name: /^sign in$/i }).click();

  await expect(page).toHaveURL(/\/applications/);
  await expect(page.getByText('Acme Corp')).toBeVisible();

  await page.getByRole('button', { name: 'test@example.com' }).click();
  await page.getByRole('menuitem', { name: /sign out/i }).click();

  await expect(page).toHaveURL(/\/login/);
  await expect(page.getByLabel(/email/i)).toBeVisible();
});
