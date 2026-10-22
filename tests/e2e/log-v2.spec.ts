import { readFile, writeFile } from 'node:fs/promises';
import { expect, test } from '@playwright/test';

// SPEC-v2 R4: the log grouped by pass; a contact opens at its own URL as one sheet; ADIF in and out.
test('add, edit, import and export on the new Log', async ({ page }, info) => {
  await page.goto('./now');
  await page.getByPlaceholder('CN87uo').fill('CN87uo');
  await page.getByRole('button', { name: 'Show my passes' }).click();
  await page.getByRole('tab', { name: 'Log' }).click();
  await expect(page.getByRole('heading', { name: 'Log' })).toBeVisible();

  await page.getByRole('button', { name: 'Add contact' }).click();
  await page.getByLabel('Their callsign').fill('K1ABC');
  await page.getByLabel('Their grid (optional)').fill('FN42');
  await page.getByRole('button', { name: 'Save contact' }).click();
  const contacts = page.getByRole('list', { name: 'Contacts by pass' });
  await expect(contacts).toContainText('K1ABC');

  // One tap opens the contact at /log/:id; back closes it and leaves the log.
  await contacts.getByRole('link', { name: /K1ABC/ }).click();
  await expect(page).toHaveURL(/\/log\/[^/]+$/);
  const sheet = page.getByRole('dialog', { name: 'Edit K1ABC' });
  await sheet.getByLabel('Their grid').fill('FN31');
  await sheet.getByRole('button', { name: 'Save' }).click();
  await expect(page).toHaveURL(/\/log$/);
  await expect(contacts).toContainText('FN31');
  await contacts.getByRole('link', { name: /K1ABC/ }).click();
  await page.goBack();
  await expect(page.getByRole('dialog')).toHaveCount(0);

  const rec = (f: Record<string, string>) => Object.entries(f).map(([k, v]) => `<${k}:${v.length}>${v}`).join(' ') + ' <EOR>\n';
  const adi = 'Test log\n<EOH>\n' + rec({ CALL: 'N7XYZ', QSO_DATE: '20260901', TIME_ON: '0130', PROP_MODE: 'SAT', SAT_NAME: 'SO-50', MODE: 'FM', GRIDSQUARE: 'DM43' });
  const path = info.outputPath('log.adi');
  await writeFile(path, adi);
  await page.locator('input[type=file]').setInputFiles(path);
  await expect(page.getByText(/Imported 1 satellite contact\./)).toBeVisible();
  await expect(contacts).toContainText('N7XYZ');
  await expect(page.getByRole('button', { name: /Grids/ })).toContainText('2');

  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: /Export ADIF: 1 new/ }).click();
  expect(await readFile(await (await download).path(), 'utf8')).toMatch(/<CALL:5>K1ABC/);
  await expect(page.getByRole('button', { name: /^Export ADIF$/ })).toBeDisabled();
});
