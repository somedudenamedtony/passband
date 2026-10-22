import { expect, test } from '@playwright/test';

// SPEC-v2 D22 / R1: every screen has a URL, deep links open, and back goes up one level.
const PASS = 'pass/25544-1761100800000';

test('the root is still the current app', async ({ page }) => {
  await page.goto('./');
  await expect(page.getByPlaceholder('CN87uo')).toBeVisible();
});

test('a deep link to a pass opens it, and back goes up to Now', async ({ page }) => {
  await page.goto(`./${PASS}`);
  // No location on this device yet: the pass page says so rather than guessing one.
  await expect(page.getByRole('heading', { name: 'No location yet' })).toBeVisible();
  await page.getByRole('button', { name: 'Back' }).click();
  await expect(page).toHaveURL(/\/passband\/now$/);
  await expect(page.getByRole('heading', { name: 'Where are you?' })).toBeVisible();
});

test('tabs are history entries and back retraces them', async ({ page }) => {
  await page.goto('./now');
  await page.getByRole('tab', { name: 'Plan' }).click();
  await expect(page.getByRole('heading', { name: 'Plan' })).toBeVisible();
  await page.getByRole('tab', { name: 'Log' }).click();
  await expect(page.getByRole('tab', { name: 'Log' })).toHaveAttribute('aria-selected', 'true');
  await page.goBack();
  await expect(page).toHaveURL(/\/passband\/plan$/);
});

test('an unknown address says so instead of guessing', async ({ page }) => {
  await page.goto('./pass/not-a-pass');
  await expect(page.getByRole('heading', { name: 'Nothing here' })).toBeVisible();
});

test('deep links open offline after one online visit', async ({ page, context }) => {
  await page.goto('./now');
  await expect(page.getByRole('heading', { name: 'Where are you?' })).toBeVisible();
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
    if (!navigator.serviceWorker.controller) {
      await new Promise((r) => navigator.serviceWorker.addEventListener('controllerchange', r, { once: true }));
    }
  });
  await context.setOffline(true);
  await page.goto(`./${PASS}/live`);
  await expect(page.getByRole('heading', { name: 'No location yet' })).toBeVisible();
});
