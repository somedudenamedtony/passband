import { expect, test } from '@playwright/test';
import { setup } from './v2';

// D21: Next up says whether the satellite should be on, and never leads with one it thinks is off.
test('Next up says whether the satellite will be on', async ({ page }) => {
  await setup(page);
  const next = page.getByRole('region', { name: /^Next up: / });
  await expect(next.getByRole('img', { name: /^(probably on|may be on)/ })).toBeVisible();
  await expect(next.getByRole('img', { name: /^probably off/ })).toHaveCount(0);
});

// SPEC-v2 §6.0: first run asks goal, radio, guidance and callsign along with the location.
test('first run sets guidance and callsign', async ({ page }) => {
  await page.goto('./');
  await page.getByRole('tab', { name: 'Just the numbers' }).click();
  await page.getByPlaceholder('W7LIT').fill('w7lit');
  await page.getByPlaceholder('CN87uo').fill('CN87uo');
  await page.getByRole('button', { name: 'Show my passes' }).click();
  await expect(page.getByRole('link', { name: 'Station' })).toHaveText('W7LIT');
  // Just the numbers: no first-contact prompt on Now.
  await expect(page.getByRole('link', { name: /Your first contact/ })).toHaveCount(0);
  await page.getByRole('link', { name: 'Station' }).click();
  await expect(page.getByPlaceholder('W7LIT')).toHaveValue('W7LIT');
  await expect(page.getByRole('tab', { name: 'Just the numbers' })).toHaveAttribute('aria-selected', 'true');
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
  await setup(page);
  await page.getByRole('link', { name: 'Search satellites' }).click();
  await page.getByLabel('Find a satellite').fill('RS-44');
  await page.getByRole('link', { name: /^RS-44/ }).click();
  // A pass already up may end mid-test, and a pass that has ended shows no frequencies: take the
  // first one that hasn't started.
  const passes = page.getByRole('button', { name: /^Show the .* pass$/ });
  await passes.first().waitFor({ timeout: 30_000 });
  for (let i = 0; ; i++) {
    await passes.nth(i).click();
    await expect(page).toHaveURL(/\/pass\/\d+-\d+$/);
    const aos = Number(/-(\d+)$/.exec(page.url())![1]);
    if (aos > (await page.evaluate(() => Date.now())) + 60_000) break;
    await page.goBack();
  }
  await page.goto(`${new URL(page.url()).pathname}/live`);

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

// §5.5: help's first-contact guide picks a real pass and opens it.
test('help picks an easy pass and opens it', async ({ page }) => {
  await setup(page);
  await page.getByRole('link', { name: /Your first contact/ }).click();
  await page.getByRole('button', { name: 'Use this pass' }).click({ timeout: 30_000 });
  await expect(page).toHaveURL(/\/pass\/\d+-\d+$/);
  await expect(page.getByRole('region', { name: 'Set your radio' })).toBeVisible();
});
