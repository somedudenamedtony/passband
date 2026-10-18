import { expect, test } from '@playwright/test';

// §5.2 / D16: the live screen runs on whatever clock the page has; here Playwright's fake one.
test('live screen tracks a pass and returns with the back button', async ({ page }) => {
  await page.clock.install();
  await page.goto('./');
  await page.getByPlaceholder('CN87uo').fill('CN87uo');
  await page.getByRole('button', { name: 'Show my passes' }).click();
  await page.getByRole('button', { name: /^(Start|Track it now)$/ }).click({ timeout: 30_000 });

  await expect(page.getByRole('img', { name: 'Sky plot' })).toBeVisible();
  const freqs = page.getByRole('region', { name: 'Frequencies' });
  await expect(freqs).toBeVisible();
  await expect(freqs).toContainText(/\d{3}\.\d{3}/);

  // Run the clock forward an hour: the pass ends and the screen says so.
  await page.clock.fastForward(60 * 60 * 1000);
  await page.clock.runFor(1000);
  await expect(page.getByText('Pass over')).toBeVisible();

  await page.goBack();
  await expect(page.getByRole('img', { name: 'Sky plot' })).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'Next 24 hours' })).toBeVisible();
});
