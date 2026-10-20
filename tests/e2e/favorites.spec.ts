import { expect, test } from '@playwright/test';

// Favorites live on the device: star, filter, survive a reload, unstar. No account anywhere.
test('star a satellite, list favorites, keep them across a reload', async ({ page }) => {
  await page.goto('./');
  await page.getByPlaceholder('CN87uo').fill('CN87uo');
  await page.getByRole('button', { name: 'Show my passes' }).click();
  await page.getByRole('heading', { name: 'Next 24 hours' }).waitFor({ timeout: 30_000 });
  await expect(page.getByRole('tab', { name: '★ Favorites 0' })).toBeVisible();

  const card = page.getByRole('region', { name: /^Pass of / });
  const name = ((await card.getAttribute('aria-label')) ?? '').replace('Pass of ', '');
  const star = card.getByRole('button', { name: `Favorite ${name}` });
  await star.click();
  await expect(star).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByRole('tab', { name: '★ Favorites 1' })).toBeVisible();

  await page.getByRole('tab', { name: /^★ Favorites/ }).click();
  await expect(page.getByRole('region', { name: `Pass of ${name}` })).toBeVisible({ timeout: 30_000 });

  await page.reload();
  await page.getByRole('heading', { name: 'Next 24 hours' }).waitFor({ timeout: 30_000 });
  await expect(page.getByRole('tab', { name: '★ Favorites 1' })).toBeVisible();

  await page.getByRole('button', { name: `About ${name}` }).click();
  const sheetStar = page.getByRole('dialog', { name }).getByRole('button', { name: `Favorite ${name}` });
  await expect(sheetStar).toHaveAttribute('aria-pressed', 'true');
  await sheetStar.click();
  await expect(sheetStar).toHaveAttribute('aria-pressed', 'false');
  await page.getByRole('button', { name: 'Close' }).click();
  await expect(page.getByRole('tab', { name: '★ Favorites 0' })).toBeVisible();
});
