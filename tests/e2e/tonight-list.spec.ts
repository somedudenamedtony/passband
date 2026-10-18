import { expect, test } from '@playwright/test';

// §5.1: one Satellites selector governs both lists; big selections stay short and searchable.
test('satellite selector, search and paging keep the Tonight lists short', async ({ page }) => {
  await page.goto('./');
  await page.getByPlaceholder('CN87uo').fill('CN87uo');
  await page.getByRole('button', { name: 'Show my passes' }).click();
  await page.getByRole('heading', { name: 'Next 24 hours' }).waitFor({ timeout: 30_000 });
  await expect(page.getByRole('tab', { name: /^Recommended/ })).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByLabel('Find a satellite')).toHaveCount(0);

  await page.getByRole('tab', { name: /^All active/ }).click();
  await page.getByRole('heading', { name: 'Next 24 hours' }).waitFor({ timeout: 30_000 });
  const upcoming = page.getByRole('region', { name: 'Upcoming passes' });
  await expect(upcoming.getByRole('listitem')).toHaveCount(8);
  await upcoming.getByRole('button', { name: /^Show \d+ more/ }).click();
  await expect(upcoming.getByRole('listitem')).toHaveCount(16);

  await page.getByLabel('Find a satellite').fill('iss');
  await expect(page.getByText(/^\d+ match/)).toBeVisible();
  for (const row of await upcoming.getByRole('listitem').all()) await expect(row).toContainText('ISS');
});
