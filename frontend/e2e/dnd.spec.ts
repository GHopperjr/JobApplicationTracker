import { expect, test } from '@playwright/test';

// `dragTo()` does not reliably trigger @dnd-kit, which listens for pointer
// events with movement thresholds. Drive the pointer manually with an
// intermediate move (docs/08-testing-and-ci.md) — a single jump to the
// destination frequently fails to register a drag-over.
test('drag a card between columns, persists after reload, history shows the transition', async ({
  page,
}) => {
  await page.goto('/applications?view=kanban');

  const card = page.getByRole('button', { name: /Acme Corp/ });
  const target = page.getByTestId('column-scheduled_for_interview');

  await card.hover();
  await page.mouse.down();
  await page.mouse.move(0, 0); // exceeds the 8px activation constraint
  await target.hover();
  await page.mouse.move(1, 1); // a second move so dnd-kit registers the target
  await page.mouse.up();

  await expect(target.getByText('Acme Corp')).toBeVisible();

  await page.reload();
  await expect(page.getByTestId('column-scheduled_for_interview').getByText('Acme Corp')).toBeVisible();

  // Open the drawer and confirm the status_history trigger recorded the
  // transition — the badge alone wouldn't prove the history row exists.
  await page.getByText('Acme Corp', { exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Acme Corp' })).toBeVisible();
  await expect(page.getByText('Timeline')).toBeVisible();
  await expect(page.getByText('Scheduled for Interview').last()).toBeVisible();
});
