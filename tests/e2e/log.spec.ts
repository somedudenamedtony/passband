import { readFile } from 'node:fs/promises';
import { expect, test } from '@playwright/test';

// §5.2 quick log → §5.4 Log tab → D12 ADIF export.
test('log a contact during a pass and export it as ADIF', async ({ page }) => {
  await page.clock.install();
  await page.goto('./');
  await page.getByPlaceholder('CN87uo').fill('CN87uo');
  await page.getByRole('button', { name: 'Show my passes' }).click();

  await page.getByRole('button', { name: 'Settings' }).click();
  await page.getByPlaceholder('W7LIT').fill('W7LIT');
  await page.getByRole('button', { name: 'Close' }).click();

  await page.getByRole('button', { name: /^(Prepare for pass|Track live)$/ }).click({ timeout: 30_000 });
  await page.getByRole('button', { name: 'Log a contact' }).click();
  const keypad = page.getByLabel('Keypad');
  for (const k of 'K1ABC') await keypad.getByRole('button', { name: k, exact: true }).click();
  await page.getByRole('textbox', { name: 'Their grid' }).focus();
  for (const k of 'FN42') await keypad.getByRole('button', { name: k, exact: true }).click();
  await page.getByRole('button', { name: 'Save K1ABC' }).click();
  await expect(page.getByText('Logged K1ABC')).toBeVisible();

  await page.getByRole('button', { name: 'Done' }).click();
  await page.getByRole('tab', { name: 'Log', exact: true }).click();
  await expect(page.getByRole('list', { name: 'Contacts' })).toContainText('K1ABC');
  await expect(page.getByText('1 / 100')).toBeVisible();

  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: /Export ADIF — 1 new/ }).click();
  const adi = await readFile(await (await download).path(), 'utf8');
  expect(adi).toMatch(/<CALL:5>K1ABC/);
  expect(adi).toMatch(/<PROP_MODE:3>SAT/);
  expect(adi).toMatch(/<SAT_NAME:\d+>\S+/);
  expect(adi).toMatch(/<STATION_CALLSIGN:5>W7LIT/);
  expect(adi).toMatch(/<MY_GRIDSQUARE:4>CN87/);
  await expect(page.getByRole('button', { name: 'Export ADIF' })).toBeDisabled();
});
