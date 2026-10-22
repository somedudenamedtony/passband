import { expect, type Page } from '@playwright/test';

/** First run with a grid, landing on Now with passes listed. */
export async function setup(page: Page, grid = 'CN87uo') {
  await page.goto('./');
  await page.getByPlaceholder('CN87uo').fill(grid);
  await page.getByRole('button', { name: 'Show my passes' }).click();
  await expect(page.getByRole('heading', { name: 'Next 24 hours' })).toBeVisible({ timeout: 30_000 });
  await expect(page.locator('.pass-row').first()).toBeVisible({ timeout: 30_000 });
}

/** The live screen for Now's Next up pass. */
export async function openNextLive(page: Page) {
  const href = await page.getByRole('region', { name: /^Next up: / }).locator('a.next-up-main').getAttribute('href');
  await page.goto(`${href}/live`);
}

/** The pass page of the first listed pass that hasn't started, optionally of one mode. */
export async function openFuturePass(page: Page, mode?: RegExp) {
  for (const b of await page.getByRole('button', { name: /low pass/ }).all()) await b.click();
  let rows = page.locator('.pass-row').filter({ hasNot: page.locator('.pr-up') });
  if (mode) rows = rows.filter({ has: page.locator('.mode-chip', { hasText: mode }) });
  await rows.first().locator('.pass-row-link').click();
  await expect(page).toHaveURL(/\/pass\/\d+-\d+$/);
}

/** The live screen of the pass page we're on. */
export async function liveFromPassPage(page: Page) {
  await page.goto(`${new URL(page.url()).pathname}/live`);
}
