import { expect, test, type Page } from '@playwright/test';

// SPEC-v2 R3: the pass page hosts practice and the live view, and after LOS it says how the pass
// went and holds the contacts made on it (D23).

async function openFmPass(page: Page) {
  await page.goto('./now');
  await page.getByPlaceholder('CN87uo').fill('CN87uo');
  await page.getByRole('button', { name: 'Show my passes' }).click();
  await expect(page.locator('.pass-row').first()).toBeVisible({ timeout: 30_000 });
  const lows = page.getByRole('button', { name: /low pass/ });
  for (const b of await lows.all()) await b.click();
  const row = page.locator('.pass-row').filter({ hasNot: page.locator('.pr-up') }).filter({ has: page.locator('.mode-chip', { hasText: /^FM$/ }) }).first();
  await row.locator('.pass-row-link').click();
  await expect(page.getByRole('region', { name: 'Set your radio' })).toBeVisible();
}

test('practice runs the pass through the live screen and Done returns to the pass', async ({ page }) => {
  await openFmPass(page);
  const passUrl = page.url();
  await page.getByRole('link', { name: 'Practice this pass' }).click();
  await expect(page.getByRole('region', { name: 'Practice', exact: true })).toBeVisible();
  await expect(page.getByRole('img', { name: 'Sky plot' })).toBeVisible();
  await expect(page.getByText(/^Rises in 0:\d\d$/)).toBeVisible();
  await page.getByRole('button', { name: 'Done' }).click();
  await expect(page).toHaveURL(passUrl);
});

test('after LOS the pass page takes the outcome and holds its contacts', async ({ page }) => {
  await page.clock.install();
  await openFmPass(page);
  await page.clock.fastForward(26 * 60 * 60 * 1000 - 60_000);
  await page.clock.runFor(2000);
  const review = page.getByRole('region', { name: 'How did it go?' });
  await expect(review).toBeVisible();
  await review.getByRole('button', { name: 'Worked' }).click();
  await expect(review.getByRole('button', { name: 'Worked' })).toHaveAttribute('aria-pressed', 'true');

  const contacts = page.getByRole('region', { name: 'Contacts on this pass' });
  await expect(contacts).toContainText('None logged');
  await contacts.getByRole('button', { name: 'Add contact' }).click();
  await page.getByLabel('Their callsign').fill('K1ABC');
  await page.getByRole('button', { name: 'Save contact' }).click();
  await expect(contacts).toContainText('K1ABC');
  await expect(contacts).toContainText('Incomplete');
  await page.reload();
  await expect(page.getByRole('region', { name: 'Contacts on this pass' })).toContainText('K1ABC');
  await expect(page.getByRole('region', { name: 'How did it go?' }).getByRole('button', { name: 'Worked' })).toHaveAttribute('aria-pressed', 'true');

  // The Log shows it under its pass, marked worked, with a way back to the pass.
  const passUrl = page.url();
  await page.getByRole('tab', { name: 'Log' }).click();
  const group = page.locator('.log-group').filter({ hasText: 'K1ABC' });
  await expect(group).toContainText('worked');
  await group.getByRole('link', { name: /→$/ }).click();
  await expect(page).toHaveURL(passUrl);
});
