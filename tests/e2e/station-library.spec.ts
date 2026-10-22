import { expect, test, type Page } from '@playwright/test';

// SPEC-v2 R6a: search the catalog, star from the satellite page, Station settings, help.
async function setup(page: Page) {
  await page.goto('./now');
  await page.getByPlaceholder('CN87uo').fill('CN87uo');
  await page.getByRole('button', { name: 'Show my passes' }).click();
  await expect(page.getByRole('heading', { name: 'Next 24 hours' })).toBeVisible({ timeout: 30_000 });
}

test('search finds a satellite; its page stars it into My satellites', async ({ page }) => {
  await setup(page);
  await page.getByRole('link', { name: 'Search satellites' }).click();
  await expect(page.getByRole('region', { name: 'My satellites' })).toContainText('None starred yet');
  await page.getByLabel('Find a satellite').fill('25544');
  await page.getByRole('link', { name: /^ISS/ }).click();
  await expect(page).toHaveURL(/\/sat\/25544$/);
  await page.getByRole('button', { name: /favorite|My satellites|Star/i }).first().click();
  // Back is one step: to the search it came from.
  await page.getByRole('button', { name: 'Back' }).click();
  await expect(page).toHaveURL(/\/library$/);
  await page.getByLabel('Find a satellite').fill('');
  await expect(page.getByRole('region', { name: 'My satellites' })).toContainText('ISS');
  // Starred: Now shows My satellites only, and the prompt to star goes away.
  await page.getByRole('tab', { name: 'Now' }).click();
  await expect(page.getByRole('heading', { name: 'Next 24 hours' })).toBeVisible();
  await expect(page.getByText('Showing every satellite that works with your radio')).toHaveCount(0);
});

test('Station sets the callsign and goal, and opens help', async ({ page }) => {
  await setup(page);
  await page.getByRole('link', { name: 'Station' }).click();
  await page.getByLabel('Callsign').fill('W7LIT');
  await page.getByRole('tab', { name: 'Listen', exact: true }).click();
  await page.reload();
  await expect(page.getByRole('link', { name: 'Station' })).toHaveText('W7LIT');
  await expect(page.getByRole('tab', { name: 'Listen', exact: true })).toHaveAttribute('aria-selected', 'true');
  await page.getByRole('link', { name: 'Help and your first contact' }).click();
  await expect(page.getByRole('heading', { name: 'Help' })).toBeVisible();
  await page.getByRole('button', { name: 'Back' }).click();
  await expect(page).toHaveURL(/\/station$/);
});
