import { readFile } from 'node:fs/promises';
import { segment } from './segment';
import { expect, test, type Page } from '@playwright/test';

async function setup(page: Page) {
  await page.goto('./');
  await page.getByPlaceholder('CN87uo').fill('CN87uo');
  await page.getByRole('button', { name: 'Show my passes' }).click();
  await page.getByRole('heading', { name: 'Next 24 hours' }).waitFor({ timeout: 30_000 });
}

// D13: record, play back, and log a contact at a moment in the recording.
test('record a pass, play it back, and log from playback', async ({ page }) => {
  await setup(page);
  await page.getByRole('button', { name: /^(Prepare for pass|Track live)$/ }).click();
  await page.getByRole('button', { name: 'Record the pass' }).click();
  await expect(page.getByText('● Recording')).toBeVisible();
  await page.waitForTimeout(2500);
  await page.getByRole('button', { name: 'Stop recording' }).click();
  await expect(page.getByText(/Recording saved/)).toBeVisible();

  await page.getByRole('button', { name: 'Done' }).click();
  await page.getByRole('tab', { name: 'Log', exact: true }).click();
  const recs = page.getByRole('region', { name: 'Recordings' });
  await expect(recs).toBeVisible();
  await recs.getByRole('button', { name: 'Play', exact: true }).click();
  await expect(recs.getByText(/\d\d:\d\d:\d\d UTC/)).toBeVisible();
  await recs.getByRole('button', { name: 'Log at this moment' }).click();
  const keypad = page.getByLabel('Keypad');
  for (const k of 'K1ABC') await keypad.getByRole('button', { name: k, exact: true }).click();
  await page.getByRole('button', { name: 'Save K1ABC' }).click();
  await expect(page.getByRole('list', { name: 'Contacts' })).toContainText('K1ABC');
});

// D17: a pass becomes a calendar file with an alarm before AOS.
test('remind me exports an .ics with an alarm', async ({ page }) => {
  await setup(page);
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Add to calendar' }).click();
  const ics = await readFile(await (await download).path(), 'utf8');
  expect(ics).toContain('BEGIN:VEVENT');
  expect(ics).toContain('TRIGGER:-PT5M');
  expect(ics).toMatch(/DTSTART:\d{8}T\d{6}Z/);
});

// §5.3: the map draws offline, with the satellite and its footprint.
test('map shows the satellite, its footprint, and reach', async ({ page }) => {
  await setup(page);
  await page.getByRole('tab', { name: 'Map', exact: true }).click();
  await expect(page.getByRole('img', { name: 'Map' })).toBeVisible();
  await expect(page.getByText(/footprint .* across/)).toBeVisible({ timeout: 15_000 });
  await segment(page, 'Region').click();
  await page.getByText(/Grids .* can reach/).click();
  await expect(page.getByRole('img', { name: 'Map' })).toBeVisible();
});
