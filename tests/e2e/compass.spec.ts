import { expect, test, type Page } from '@playwright/test';
import { segment } from './segment';

/** Feed the page an Android-style absolute orientation reading (D10). */
async function orient(page: Page, alpha: number, beta: number, gamma: number) {
  await page.evaluate(
    ([a, b, g]) => {
      window.dispatchEvent(
        new DeviceOrientationEvent('deviceorientationabsolute', { alpha: a, beta: b, gamma: g, absolute: true }),
      );
    },
    [alpha, beta, gamma],
  );
}

/**
 * Newer Chrome, like iOS Safari, gates motion sensors behind DeviceOrientationEvent.requestPermission()
 * from a tap, so the app shows "Turn on the compass" first. Tap it when it's there; older engines
 * go straight to listening.
 */
// What a user tapping "Allow" grants. Headless has no one to answer the prompt.
test.use({ permissions: ['accelerometer', 'gyroscope', 'magnetometer'] });

async function turnOnCompass(page: Page) {
  const button = page.getByRole('button', { name: 'Turn on the compass' });
  if (await button.isVisible().catch(() => false)) await button.click();
}

async function setup(page: Page) {
  await page.goto('./');
  await page.getByPlaceholder('CN87uo').fill('CN87uo');
  await page.getByRole('button', { name: 'Show my passes' }).click();
  await page.getByRole('heading', { name: 'Next 24 hours' }).waitFor({ timeout: 30_000 });
}

test('compass view points the way to the satellite and shows its accuracy state', async ({ page }) => {
  await setup(page);
  await page.getByRole('button', { name: /^(Prepare for pass|Track live)$/ }).click();
  await segment(page, 'Compass').click();
  await turnOnCompass(page);
  const feed = setInterval(() => void orient(page, 0, 20, 0).catch(() => undefined), 150);
  try {
    await expect(page.getByRole('status', { name: 'Pointing' })).toBeVisible();
    await expect(page.getByRole('status', { name: 'Pointing' })).toContainText(/Turn|Raise|Lower|On target/);
    await expect(page.getByText(/not calibrated/)).toBeVisible();
  } finally {
    clearInterval(feed);
  }
});

test('without a compass the live screen falls back to the north-up sky plot', async ({ page }) => {
  await setup(page);
  await page.getByRole('button', { name: /^(Prepare for pass|Track live)$/ }).click();
  await segment(page, 'Compass').click();
  await turnOnCompass(page);
  await expect(page.getByText('No compass on this device')).toBeVisible({ timeout: 10_000 });
  await expect(page.getByRole('tab', { name: 'Sky' })).toHaveAttribute('aria-selected', 'true');
});

test('a horizon mask set by hand is saved with the location', async ({ page }) => {
  await setup(page);
  await page.getByRole('button', { name: /CN87/ }).first().click();
  await page.getByRole('button', { name: /Horizon mask for/ }).click();
  await page.getByText('Adjust by hand').click();
  await page.getByRole('slider', { name: 'Minimum elevation from 180° to 190°' }).fill('20');
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page.getByText('horizon mask set')).toBeVisible();
});
