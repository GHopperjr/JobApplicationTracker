import { expect, test } from '@playwright/test';

test('toggling Board and Table shows the same data', async ({ page }) => {
  await page.goto('/applications?view=kanban');
  await expect(page.getByText('Acme Corp')).toBeVisible();
  await expect(page.getByText('Globex')).toBeVisible();
  await expect(page.getByText('Initech')).toBeVisible();

  await page.getByRole('button', { name: 'Table' }).click();
  await expect(page).toHaveURL(/view=table/);
  await expect(page.getByText('Acme Corp')).toBeVisible();
  await expect(page.getByText('Globex')).toBeVisible();
  await expect(page.getByText('Initech')).toBeVisible();
});

test('a filter survives a reload via the URL', async ({ page }) => {
  await page.goto('/applications?view=table');

  await page.getByRole('group', { name: /filter by status/i }).getByRole('button', { name: 'Rejected' }).click();

  await expect(page.getByText('Initech')).toBeVisible();
  await expect(page.getByText('Acme Corp')).not.toBeVisible();
  await expect(page).toHaveURL(/status=rejected/);

  await page.reload();
  await expect(page.getByText('Initech')).toBeVisible();
  await expect(page.getByText('Acme Corp')).not.toBeVisible();
});
