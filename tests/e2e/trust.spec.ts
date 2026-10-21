import { readFile } from 'node:fs/promises';
import { expect, test } from '@playwright/test';
import { segment } from './segment';

// D21: the card says whether the satellite should be on, and why.
test('the pass card says whether the satellite will be on', async ({ page }) => {
  await page.goto('./');
  await page.getByPlaceholder('CN87uo').fill('CN87uo');
  await page.getByRole('button', { name: 'Show my passes' }).click();
  await page.getByRole('heading', { name: 'Next 24 hours' }).waitFor({ timeout: 30_000 });
  await expect(page.getByText(/^(Should be on\.|Might be on\.)/)).toBeVisible();
  // The card never leads with a pass it thinks is off.
  await expect(page.getByText(/^Probably off\./)).toHaveCount(0);
});

// §5.0: first run asks experience and callsign along with the location.
test('first run sets experience and callsign', async ({ page }) => {
  await page.goto('./');
  await segment(page, 'I’ve made contacts').click();
  await page.getByPlaceholder('W7LIT').fill('w7lit');
  await page.getByPlaceholder('CN87uo').fill('CN87uo');
  await page.getByRole('button', { name: 'Show my passes' }).click();
  await expect(page.getByRole('tab', { name: 'Help' })).toBeVisible();
  await page.getByRole('button', { name: 'Settings' }).click();
  await expect(page.getByPlaceholder('W7LIT')).toHaveValue('W7LIT');
});

// §5.4: add a contact by hand, and import an existing log.
test('add a contact by hand and import an ADIF log', async ({ page }, info) => {
  await page.goto('./');
  await page.getByPlaceholder('CN87uo').fill('CN87uo');
  await page.getByRole('button', { name: 'Show my passes' }).click();
  await page.getByRole('tab', { name: 'Log', exact: true }).click();

  await page.getByRole('button', { name: 'Add contact' }).click();
  await page.getByLabel('Their callsign').fill('K1ABC');
  await page.getByLabel('Their grid (optional)').fill('FN42');
  await page.getByRole('button', { name: 'Save contact' }).click();
  await expect(page.getByRole('list', { name: 'Contacts' })).toContainText('K1ABC');

  const rec = (f: Record<string, string>) =>
    Object.entries(f)
      .map(([k, v]) => `<${k}:${v.length}>${v}`)
      .join(' ') + ' <EOR>\n';
  const adi =
    'Test log\n<EOH>\n' +
    rec({ CALL: 'N7XYZ', QSO_DATE: '20260901', TIME_ON: '0130', PROP_MODE: 'SAT', SAT_NAME: 'SO-50', MODE: 'FM', GRIDSQUARE: 'DM43' }) +
    rec({ CALL: 'KX9X', QSO_DATE: '20260902', TIME_ON: '0200', PROP_MODE: 'SAT', SAT_NAME: 'RS-44', MODE: 'SSB', SUBMODE: 'USB', GRIDSQUARE: 'EM10' }) +
    rec({ CALL: 'W1AW', QSO_DATE: '20260903', TIME_ON: '1200', MODE: 'CW' });
  const path = info.outputPath('log.adi');
  await import('node:fs/promises').then((fs) => fs.writeFile(path, adi));
  await page.locator('input[type=file]').setInputFiles(path);
  await expect(page.getByText(/Imported 2 satellite contacts\. 1 non-satellite contact left out\./)).toBeVisible();
  await expect(page.getByText('3 / 100')).toBeVisible();

  // Imported ones count as exported; only the hand-added contact is new.
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: /Export ADIF — 1 new/ }).click();
  expect(await readFile(await (await download).path(), 'utf8')).toMatch(/<CALL:5>K1ABC/);

  // Importing the same file again adds nothing.
  await page.locator('input[type=file]').setInputFiles(path);
  await expect(page.getByText(/Imported 0 satellite contacts\. 2 already in the log\./)).toBeVisible();
});

// §5.2 linear transponders: the spot at the satellite stays put; TX and RX follow it.
test('a linear transponder pass tunes by one true frequency', async ({ page }) => {
  // Slow the worker's track reply, as on a busy CI runner: until the track is in, the screen must
  // not show the passband edges as frequencies to set.
  await page.addInitScript(() => {
    const W = window.Worker;
    window.Worker = class extends W {
      constructor(u: string | URL, o?: WorkerOptions) {
        super(u, o);
        const add = this.addEventListener.bind(this);
        let handler: ((e: MessageEvent) => void) | null = null;
        Object.defineProperty(this, 'onmessage', {
          set: (h) => { handler = h; },
          get: () => handler,
        });
        add('message', (e: MessageEvent) => {
          const d = e.data as { type?: string };
          setTimeout(() => handler?.(e), d.type === 'track' ? 1500 : 0);
        });
      }
    } as typeof Worker;
  });
  await page.goto('./');
  await segment(page, 'I’ve made contacts').click();
  await page.getByPlaceholder('CN87uo').fill('CN87uo');
  await page.getByRole('button', { name: 'Show my passes' }).click();
  await page.getByRole('heading', { name: 'Next 24 hours' }).waitFor({ timeout: 30_000 });
  await page.getByRole('tab', { name: /^Available/ }).click();
  await page.getByLabel('Find a satellite').fill('RS-44');
  const upcoming = page.getByRole('region', { name: 'Upcoming passes' });
  await upcoming.getByRole('button').first().click({ timeout: 30_000 });
  await page.getByRole('button', { name: /^(Prepare for pass|Track live)$/ }).click();

  const band = page.getByRole('region', { name: 'Passband' });
  await expect(band).toBeVisible();
  await expect(band).toContainText(/transmit LSB/);
  const tx = page.getByRole('region', { name: 'Frequencies' }).getByText(/^145\.\d+$/);
  const before = await tx.textContent();
  await band.getByRole('button', { name: 'Up 1000 hertz' }).click();
  // Inverting: moving up the downlink moves the uplink down.
  await expect(tx).not.toHaveText(before!);
  const after = await tx.textContent();
  expect(Number(after)).toBeLessThan(Number(before));
});
