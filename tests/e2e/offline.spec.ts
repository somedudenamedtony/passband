import { expect, test } from '@playwright/test';

// §6 / §10: the app must open and compute passes with networking off after one online visit.
test('works offline after one online visit', async ({ page, context }) => {
  await page.goto('./');
  await page.getByPlaceholder('CN87uo').fill('CN87uo');
  await page.getByRole('button', { name: 'Show my passes' }).click();
  await expect(page.getByRole('heading', { name: 'Next 24 hours' })).toBeVisible({ timeout: 30_000 });

  // Wait until the service worker controls the page, so the reload is served from its cache.
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
    if (!navigator.serviceWorker.controller) {
      await new Promise((r) => navigator.serviceWorker.addEventListener('controllerchange', r, { once: true }));
    }
  });

  await context.setOffline(true);
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Next 24 hours' })).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText(/Rises|Up now/).first()).toBeVisible();
});
