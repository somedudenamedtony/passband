import { expect, test, type Page } from '@playwright/test';

async function setup(page: Page, listen = false) {
  await page.goto('./');
  if (listen) await page.getByRole('tab', { name: 'Listen', exact: true }).click();
  await page.getByLabel('Your radio', { exact: true }).selectOption('fm');
  await page.getByPlaceholder('CN87uo').fill('CN87uo');
  await page.getByRole('button', { name: 'Show my passes' }).click();
  await expect(page.getByRole('region', { name: /^Pass of / })).toBeVisible({ timeout: 30_000 });
}

test('filters govern the featured pass, persist across tabs and reloads, and carry selection to the map', async ({ page }) => {
  await setup(page);
  const name = (await page.getByRole('region', { name: /^Pass of / }).getAttribute('aria-label'))!.replace('Pass of ', '');
  await page.getByRole('tab', { name: /^Available/ }).click();
  await page.getByLabel('Find a satellite').fill(name);
  const card = page.getByRole('region', { name: `Pass of ${name}`, exact: true });
  await expect(card).toBeVisible({ timeout: 30_000 });
  await page.getByRole('tab', { name: 'Map', exact: true }).click();
  const satellite = page.getByLabel('Satellite', { exact: true });
  await expect(satellite.locator('option:checked')).toHaveText(name);
  await page.getByRole('tab', { name: 'Passes', exact: true }).click();
  await expect(page.getByLabel('Find a satellite')).toHaveValue(name);
  await page.reload();
  await expect(page.getByLabel('Find a satellite')).toHaveValue(name);
  await expect(card).toBeVisible({ timeout: 30_000 });
  await page.getByLabel('Find a satellite').fill('no-such-satellite');
  await expect(page.getByRole('region', { name: /^Pass of / })).toHaveCount(0);
});

test('listener preparation has an immediate checklist, receive-only controls, and saved listening progress', async ({ page }) => {
  await page.clock.install();
  await setup(page, true);
  await page.getByRole('button', { name: /^(Prepare for pass|Track live)$/ }).click();
  const preparation = page.getByRole('region', { name: 'Pass preparation' });
  await expect(preparation.getByRole('checkbox').first()).toBeVisible();
  await expect(page.getByRole('button', { name: 'Test cues' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Log a contact' })).toHaveCount(0);
  await expect(page.getByRole('region', { name: 'Frequencies' })).not.toContainText('Transmit');
  await page.getByRole('tab', { name: 'Sky', exact: true }).click();
  await page.getByRole('button', { name: 'Done', exact: true }).click();
  await page.getByRole('button', { name: /^(Prepare for pass|Track live)$/ }).click();
  await expect(page.getByRole('tab', { name: 'Sky', exact: true })).toHaveAttribute('aria-selected', 'true');
  await page.clock.fastForward(26 * 60 * 60 * 1000);
  await page.clock.runFor(1000);
  const review = page.getByRole('region', { name: 'Pass review' });
  await review.getByRole('button', { name: 'Heard the satellite', exact: true }).click();
  await expect(review.getByRole('status')).toContainText('Listening result saved');
  await page.getByRole('button', { name: 'Done', exact: true }).click();
  await page.getByRole('tab', { name: 'Learn', exact: true }).click();
  await expect(page.getByText(/You’ve heard satellites on 1 pass\./)).toBeVisible();
});

test('guidance and compact details are independent, and quick logging accepts keyboard entry', async ({ page }) => {
  await setup(page);
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  await page.getByRole('tab', { name: 'I’ve made contacts', exact: true }).click();
  await page.getByRole('switch', { name: 'Show operating tips' }).check();
  await page.getByRole('switch', { name: 'Compact pass details' }).uncheck();
  await page.getByRole('button', { name: 'Close', exact: true }).click();
  await page.reload();
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  await expect(page.getByRole('switch', { name: 'Show operating tips' })).toBeChecked();
  await expect(page.getByRole('switch', { name: 'Compact pass details' })).not.toBeChecked();
  await page.getByRole('button', { name: 'Close', exact: true }).click();
  await page.getByRole('button', { name: /^(Prepare for pass|Track live)$/ }).click();
  await page.getByRole('button', { name: 'Log a contact', exact: true }).click();
  await page.getByRole('textbox', { name: 'Their callsign', exact: true }).fill('k1abc');
  await page.getByRole('textbox', { name: 'Their grid', exact: true }).fill('fn42');
  await page.getByRole('textbox', { name: 'Their grid', exact: true }).press('Enter');
  await expect(page.getByText('Logged K1ABC', { exact: true })).toBeVisible();
});

test.describe('phone planning', () => {
  test.use({ viewport: { width: 390, height: 664 }, hasTouch: true });
  test('primary action is visible without scrolling and details remain expandable', async ({ page }) => {
    await setup(page);
    const card = page.getByRole('region', { name: /^Pass of / });
    await expect(card.getByRole('button', { name: /^(Prepare for pass|Track live)$/ })).toBeInViewport({ ratio: 1 });
    await card.getByText('Radio setup and pass details', { exact: true }).click();
    await expect(card.getByText('AOS', { exact: true })).toBeVisible();
    await page.screenshot({ path: test.info().outputPath('phone-planning.png') });
  });
});
