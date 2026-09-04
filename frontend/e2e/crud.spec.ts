import { expect, test } from '@playwright/test';

const COMPANY = 'E2E Test Company';
const COMPANY_EDITED = 'E2E Test Company (Edited)';

// A precise attribute selector, not getByRole('button', { name: /actions for/i })
// scoped under the card: the card's own role="button" div has no explicit
// aria-label, so its computed accessible name concatenates every descendant
// label — including this button's own "Actions for X" — and both would
// match. aria-label is a real attribute only on the actual trigger button.
function actionsButton(page: import('@playwright/test').Page, company: string) {
  return page.locator(`button[aria-label="Actions for ${company}"]`);
}

test('add via modal, appears on board, edit, persists after reload, delete', async ({ page }) => {
  await page.goto('/applications');

  await page.getByRole('button', { name: /add application/i }).click();
  await page.getByLabel(/company name/i).fill(COMPANY);
  await page.getByLabel(/job title/i).fill('E2E Test Role');
  await page.getByRole('button', { name: /^add application$/i }).click();

  await expect(page.getByText(COMPANY, { exact: true })).toBeVisible();

  // Edit via the card's actions menu.
  await actionsButton(page, COMPANY).click();
  await page.getByRole('menuitem', { name: /^edit$/i }).click();
  await page.getByLabel(/company name/i).fill(COMPANY_EDITED);
  await page.getByRole('button', { name: /save changes/i }).click();

  await expect(page.getByText(COMPANY_EDITED, { exact: true })).toBeVisible();

  // Persists after a reload — a real request round-trip, not just cache.
  await page.reload();
  await expect(page.getByText(COMPANY_EDITED, { exact: true })).toBeVisible();

  // Delete and confirm it's gone.
  await actionsButton(page, COMPANY_EDITED).click();
  await page.getByRole('menuitem', { name: /^delete$/i }).click();
  await page.getByRole('button', { name: /^delete$/i }).click(); // confirm dialog

  await expect(page.getByText(COMPANY_EDITED, { exact: true })).not.toBeVisible();
});
