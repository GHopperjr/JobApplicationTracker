import { expect, test } from '@playwright/test';

// `dragTo()` does not reliably trigger @dnd-kit, which listens for pointer
// events with movement thresholds. Drive the pointer manually via explicit
// coordinates rather than docs/08-testing-and-ci.md's `mouse.move(0, 0)` /
// `mouse.move(1, 1)` snippet — those are absolute viewport coordinates near
// the top-left corner, not a path to the target, and in practice dnd-kit
// picks the card up (confirmed by its own "was dropped" a11y announcement)
// but never registers a collision with the destination column. Walking the
// pointer from the card's center to the target's center in steps is what
// actually makes dnd-kit's collision detection see it arrive there.
test('drag a card between columns, persists after reload, history shows the transition', async ({
  page,
}) => {
  await page.goto('/applications?view=kanban');

  // Not getByRole('button', { name: /Acme Corp/ }) — the card's role="button"
  // div has no explicit aria-label, so its computed accessible name
  // concatenates every descendant's text/label, including the "Actions for
  // Acme Corp" button's own label, and both end up matching. The actions
  // button and the reorder handle are real <button>/<span> tags, not <div>s,
  // so scoping by tag disambiguates them from the card container itself.
  const card = page.locator('div[role="button"]').filter({ hasText: 'Acme Corp' });
  const target = page.getByTestId('column-scheduled_for_interview');

  const cardBox = await card.boundingBox();
  const targetBox = await target.boundingBox();
  if (!cardBox || !targetBox) throw new Error('card or target column not found');

  const startX = cardBox.x + cardBox.width / 2;
  const startY = cardBox.y + cardBox.height / 2;
  const endX = targetBox.x + targetBox.width / 2;
  const endY = targetBox.y + targetBox.height / 2;

  await page.mouse.move(startX, startY);
  await page.mouse.down();
  await page.mouse.move(startX + 10, startY + 10, { steps: 5 }); // exceeds the 8px activation constraint
  await page.mouse.move(endX, endY, { steps: 10 }); // travel over the target so collision detection sees it
  await page.mouse.move(endX, endY, { steps: 1 }); // one more move to let the `over` state settle before drop
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
