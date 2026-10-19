import { expect, test } from '@playwright/test';

// The satellite info sheet, and picking a pass brings the card back into view.
test('info sheet shows a satellite, and picking a pass refocuses the card', async ({ page }) => {
  await page.goto('./');
  await page.getByPlaceholder('CN87uo').fill('CN87uo');
  await page.getByRole('button', { name: 'Show my passes' }).click();
  await page.getByRole('heading', { name: 'Next 24 hours' }).waitFor({ timeout: 30_000 });

  // Pick the last pass in the list: the page scrolls back up to the card, which now shows it.
  const rows = page.getByRole('region', { name: 'Upcoming passes' }).locator('button.row');
  const last = rows.last();
  const name = (await last.locator('.row-title').innerText()).trim();
  await last.click();
  const card = page.getByRole('region', { name: `Pass of ${name}` });
  await expect(card).toBeInViewport();
  await expect(page.getByText('Selected pass')).toBeVisible();

  await card.getByRole('button', { name: `About ${name}` }).click();
  const sheet = page.getByRole('dialog', { name });
  await expect(sheet.getByRole('region', { name: 'Transmitters' })).toBeVisible();
  await expect(sheet.getByRole('region', { name: 'Orbit' })).toContainText(/min/);
  await expect(sheet.getByRole('region', { name: 'Your contacts' })).toContainText('yet');
  await expect(sheet.getByRole('region', { name: 'Recent reports' })).toBeVisible();

  // A pass from the sheet closes it and lands on the card.
  await sheet.getByRole('region', { name: 'Next passes' }).getByRole('button').first().click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.getByRole('region', { name: `Pass of ${name}` })).toBeInViewport();
});
