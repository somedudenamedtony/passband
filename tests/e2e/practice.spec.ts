import { expect, test } from '@playwright/test';
import { segment } from './segment';

// D16: practice runs a real pass through the same live screen on a simulated clock.
test('practice a pass from the Learn tab', async ({ page }) => {
  await page.goto('./');
  await page.getByPlaceholder('CN87uo').fill('CN87uo');
  await page.getByRole('button', { name: 'Show my passes' }).click();
  await page.getByRole('tab', { name: 'Learn' }).click();

  await page.getByRole('button', { name: /^Practice .+ at / }).first().click({ timeout: 30_000 });
  const practice = page.getByRole('region', { name: 'Practice', exact: true });
  await expect(practice).toBeVisible();
  await expect(page.getByRole('img', { name: 'Sky plot' })).toBeVisible();
  // Practice starts a minute before AOS, so the screen counts down to the rise.
  await expect(page.getByText(/^Rises in 0:\d\d$/)).toBeVisible();

  await segment(practice, '4×').click();
  await expect(practice.getByRole('status')).toContainText(/On frequency|Drifting|Off frequency/, { timeout: 30_000 });
  await practice.getByRole('button', { name: 'Tune up one step' }).click();

  await page.getByRole('button', { name: 'Done' }).click();
  await expect(page.getByRole('tab', { name: 'Learn' })).toHaveAttribute('aria-selected', 'true');
});

test('"Use this pass" selects the easiest pass on Tonight', async ({ page }) => {
  await page.goto('./');
  await page.getByPlaceholder('CN87uo').fill('CN87uo');
  await page.getByRole('button', { name: 'Show my passes' }).click();
  await page.getByRole('tab', { name: 'Learn' }).click();
  await page.getByRole('button', { name: 'Use this pass' }).click({ timeout: 30_000 });
  await expect(page.getByText(/Next good pass|Selected pass/)).toBeVisible();
  await expect(page.getByRole('tab', { name: 'Tonight', exact: true })).toHaveAttribute('aria-selected', 'true');
});
