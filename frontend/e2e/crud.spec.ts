import { expect, test } from '@playwright/test';

// A precise attribute selector, not getByRole('button', { name: /actions for/i })
// scoped under the card: the card's own role="button" div has no explicit
// aria-label, so its computed accessible name concatenates every descendant
// label — including this button's own "Actions for X" — and both would
// match. aria-label is a real attribute only on the actual trigger button.
function actionsButton(page: import('@playwright/test').Page, company: string) {
  return page.locator(`button[aria-label="Actions for ${company}"]`);
}

test('add via modal, appears on board, edit, persists after reload, delete', async ({ page }) => {
  // Computed per test run (including CI's automatic retry of a failed
  // attempt), not a module-level constant — a retry reruns this whole test
  // against the SAME database (only reset once per whole suite run), so a
  // fixed name would collide with the previous attempt's leftover row if it
  // failed after creating one but before deleting it.
  const company = `E2E Test Company ${Date.now()}`;
  const companyEdited = `${company} (Edited)`;

  await page.goto('/applications');

  await page.getByRole('button', { name: /add application/i }).click();
  await page.getByLabel(/company name/i).fill(company);
  await page.getByLabel(/job title/i).fill('E2E Test Role');
  await page.getByRole('button', { name: /^add application$/i }).click();

  // Wait for the modal's close animation to finish before touching the
  // board underneath — its backdrop is `fixed inset-0`, still present and
  // still receiving pointer events during the exit transition, so a click
  // that lands before it's gone can hit the backdrop instead of the card.
  await expect(page.getByRole('dialog')).not.toBeVisible();

  await expect(page.getByText(company, { exact: true })).toBeVisible();

  // Edit via the card's actions menu.
  await actionsButton(page, company).click();
  await page.getByRole('menuitem', { name: /^edit$/i }).click();
  await page.getByLabel(/company name/i).fill(companyEdited);
  await page.getByRole('button', { name: /save changes/i }).click();
  await expect(page.getByRole('dialog')).not.toBeVisible();

  await expect(page.getByText(companyEdited, { exact: true })).toBeVisible();

  // Persists after a reload — a real request round-trip, not just cache.
  await page.reload();
  await expect(page.getByText(companyEdited, { exact: true })).toBeVisible();

  // Delete and confirm it's gone.
  await actionsButton(page, companyEdited).click();
  await page.getByRole('menuitem', { name: /^delete$/i }).click();
  await page.getByRole('button', { name: /^delete$/i }).click(); // confirm dialog

  await expect(page.getByText(companyEdited, { exact: true })).not.toBeVisible();
});
