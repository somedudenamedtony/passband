import { expect, test, type Page } from '@playwright/test';
import { waitForStored } from './v2';

// SPEC-v2 R2: Now answers "what's next" with zero taps; one tap reaches the radio setup.
test.use({ viewport: { width: 360, height: 780 } });

async function setup(page: Page) {
  await page.goto('./now');
  await page.getByPlaceholder('CN87uo').fill('CN87uo');
  await page.getByRole('button', { name: 'Show my passes' }).click();
  await expect(page.getByRole('heading', { name: 'Next 24 hours' })).toBeVisible();
  await expect(page.locator('.pass-row').first()).toBeVisible({ timeout: 30_000 });
}

test('Now shows the next pass and one-line rows', async ({ page }) => {
  await setup(page);
  // Zero taps: the next pass, with when, what and the one sentence.
  const next = page.getByRole('region', { name: /^Next up: / });
  await expect(next).toBeVisible();
  await expect(next.getByText(/^(Rises|Up now)/)).toBeVisible();
  // D26: no row wraps at 360 px.
  const tall = await page.locator('.pass-row-link').evaluateAll((rows) =>
    rows.filter((r) => [...r.children].some((c) => c.getBoundingClientRect().height > 26)).length,
  );
  expect(tall).toBe(0);
});

test('one tap from a row reaches the radio setup, and a plan survives a reload', async ({ page }) => {
  await setup(page);
  const row = page.locator('.pass-row').filter({ hasNot: page.locator('.pr-up') }).first();
  await row.locator('.pass-row-link').click();
  await expect(page).toHaveURL(/\/pass\/\d+-\d+$/);
  await expect(page.getByRole('region', { name: 'Set your radio' })).toBeVisible();
  await page.getByRole('button', { name: /I’m going for this one/ }).click();
  await page.getByLabel('Note').fill('From the park');
  await page.getByLabel('Note').blur();
  await waitForStored(page, 'plans', "rows.some((p) => p.note === 'From the park')");
  await page.reload();
  await expect(page.getByRole('button', { name: '★ Going' })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByLabel('Note')).toHaveValue('From the park');
  await page.getByRole('button', { name: 'Back' }).click();
  await expect(page).toHaveURL(/\/now$/);
  await expect(page.getByRole('region', { name: /^Next up: / }).getByText('★ Planned')).toBeVisible({ timeout: 30_000 });
});

test('the location chip opens one sheet, and back closes it', async ({ page }) => {
  await setup(page);
  await page.getByRole('button', { name: /^Location: / }).click();
  await expect(page.getByRole('dialog', { name: 'Locations' })).toBeVisible();
  await page.getByRole('button', { name: 'Close' }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
});
