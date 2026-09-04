import { expect, test as setup } from '@playwright/test';

const authFile = 'e2e/.auth/user.json';

// Signs in once through the real UI and saves the resulting storage state.
// Every other spec's project depends on this and starts already
// authenticated — only auth.spec.ts itself exercises the sign-in/out UI flow.
setup('authenticate', async ({ page }) => {
  await page.goto('/login');
  await page.getByLabel(/email/i).fill('test@example.com');
  await page.getByLabel(/password/i).fill('password123');
  await page.getByRole('button', { name: /^sign in$/i }).click();

  await expect(page).toHaveURL(/\/applications/);
  await page.context().storageState({ path: authFile });
});
