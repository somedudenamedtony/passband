import { expect, test } from '@playwright/test';

// D16: practice runs a real pass through the same live screen on a simulated clock.
test('practice a pass from the Learn tab', async ({ page }) => {
  await page.goto('./');
  await page.getByPlaceholder('CN87uo').fill('CN87uo');
  await page.getByRole('button', { name: 'Show my passes' }).click();
  await page.getByRole('button', { name: 'Learn' }).click();

  await page.getByRole('button', { name: /^Practice / }).first().click({ timeout: 30_000 });
  const practice = page.getByRole('region', { name: 'Practice' });
  await expect(practice).toBeVisible();
  await expect(page.getByRole('img', { name: 'Sky plot' })).toBeVisible();
  // Practice starts a minute before AOS, so the screen counts down to the rise.
  await expect(page.locator('header').last()).toContainText(/rises in 0:\d\d/);

  await practice.getByRole('radio', { name: '4×' }).click();
  await expect(practice.getByRole('status')).toContainText(/On frequency|Drifting|Off frequency/, { timeout: 30_000 });
  await practice.getByRole('button', { name: 'Tune up one step' }).click();

  await page.getByRole('button', { name: 'Done' }).click();
  await expect(page.getByRole('heading', { name: 'Learn' })).toBeVisible();
});

test('"Use this pass" selects the easiest pass on Tonight', async ({ page }) => {
  await page.goto('./');
  await page.getByPlaceholder('CN87uo').fill('CN87uo');
  await page.getByRole('button', { name: 'Show my passes' }).click();
  await page.getByRole('button', { name: 'Learn' }).click();
  await page.getByRole('button', { name: 'Use this pass' }).click({ timeout: 30_000 });
  await expect(page.getByText(/Next good pass|Selected pass/)).toBeVisible();
  await expect(page.getByRole('button', { name: 'Tonight', exact: true })).toHaveAttribute('aria-current', 'page');
});
