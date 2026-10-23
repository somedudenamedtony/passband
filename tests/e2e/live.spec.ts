import { readFile } from 'node:fs/promises';
import { expect, test } from '@playwright/test';
import { liveFromPassPage, openFuturePass, openNextLive, setup, waitForStored } from './v2';

// §5.2 / D16: the live screen runs on whatever clock the page has; here Playwright's fake one.
test('live screen tracks a pass and returns with the back button', async ({ page }) => {
  await page.clock.install();
  await setup(page);
  await openNextLive(page);

  await expect(page.getByRole('img', { name: 'Sky plot' })).toBeVisible();
  const freqs = page.getByRole('region', { name: 'Frequencies' });
  await expect(freqs).toBeVisible();
  await expect(freqs).toContainText(/\d{3}\.\d{3}/);

  // Run the clock past any pass in the next day: the tracked one ends and the screen says so.
  await page.clock.fastForward(26 * 60 * 60 * 1000);
  await page.clock.runFor(1000);
  await expect(page.getByText('Pass over')).toBeVisible();

  await page.goBack();
  await expect(page.getByRole('img', { name: 'Sky plot' })).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'Next 24 hours' })).toBeVisible();
});

// §5.2 quick log → the Log → D12 ADIF export, with the contact under its pass (D23).
test('log a contact during a pass and export it as ADIF', async ({ page }) => {
  await page.clock.install();
  await setup(page);
  await page.getByRole('link', { name: 'Station' }).click();
  await page.getByPlaceholder('W7LIT').fill('W7LIT');
  await page.getByRole('tab', { name: 'Now' }).click();

  await openNextLive(page);
  await page.getByRole('button', { name: 'Log a contact' }).click();
  const keypad = page.getByLabel('Keypad');
  for (const k of 'K1ABC') await keypad.getByRole('button', { name: k, exact: true }).click();
  await page.getByRole('textbox', { name: 'Their grid' }).focus();
  for (const k of 'FN42') await keypad.getByRole('button', { name: k, exact: true }).click();
  await page.getByRole('button', { name: 'Save K1ABC' }).click();
  await expect(page.getByText('Logged K1ABC')).toBeVisible();

  await page.getByRole('button', { name: 'Done' }).click();
  await expect(page).toHaveURL(/\/pass\/\d+-\d+$/);
  await page.getByRole('tab', { name: 'Log', exact: true }).click();
  await expect(page.locator('.log-group').filter({ hasText: 'K1ABC' }).getByRole('link', { name: /→$/ })).toBeVisible();
  await expect(page.getByText('1 / 100')).toBeVisible();

  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: /Export ADIF: 1 new/ }).click();
  const adi = await readFile(await (await download).path(), 'utf8');
  expect(adi).toMatch(/<CALL:5>K1ABC/);
  expect(adi).toMatch(/<PROP_MODE:3>SAT/);
  expect(adi).toMatch(/<SAT_NAME:\d+>\S+/);
  expect(adi).toMatch(/<STATION_CALLSIGN:5>W7LIT/);
  expect(adi).toMatch(/<MY_GRIDSQUARE:4>CN87/);
  await expect(page.getByRole('button', { name: /^Export ADIF$/ })).toBeDisabled();
});

// D19: a listener prepares with a checklist and receive-only controls; tracking view is remembered.
test('listener preparation has a checklist, receive-only controls, and a remembered view', async ({ page }) => {
  await page.goto('./');
  await page.getByRole('tab', { name: 'Listen', exact: true }).click();
  await page.getByLabel('Your radio').selectOption({ label: 'FM handheld' });
  await page.getByPlaceholder('CN87uo').fill('CN87uo');
  await page.getByRole('button', { name: 'Show my passes' }).click();
  await expect(page.locator('.pass-row').first()).toBeVisible({ timeout: 30_000 });
  await openFuturePass(page);
  await liveFromPassPage(page);

  const preparation = page.getByRole('region', { name: 'Pass preparation' });
  await expect(preparation.getByRole('checkbox').first()).toBeVisible();
  await expect(page.getByRole('button', { name: 'Test cues' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Log a contact' })).toHaveCount(0);
  await expect(page.getByRole('region', { name: 'Frequencies' })).not.toContainText('Transmit');
  await page.getByRole('tab', { name: 'Sky', exact: true }).click();
  await waitForStored(page, 'settings', "rows.some((r) => r && r.remembered && r.remembered.liveView === 'sky')");
  await page.reload();
  await expect(page.getByRole('tab', { name: 'Sky', exact: true })).toHaveAttribute('aria-selected', 'true');
});
