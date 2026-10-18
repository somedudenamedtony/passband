import { expect, test, type Page } from '@playwright/test';

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

async function setup(page: Page) {
  await page.goto('./');
  await page.getByPlaceholder('CN87uo').fill('CN87uo');
  await page.getByRole('button', { name: 'Show my passes' }).click();
  await page.getByRole('heading', { name: 'Next 24 hours' }).waitFor({ timeout: 30_000 });
}

test('compass view points the way to the satellite and shows its accuracy state', async ({ page }) => {
  await setup(page);
  await page.getByRole('button', { name: /^(Start|Track it now)$/ }).click();
  await page.getByRole('radio', { name: 'Compass' }).click();
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
  await page.getByRole('button', { name: /^(Start|Track it now)$/ }).click();
  await page.getByRole('radio', { name: 'Compass' }).click();
  await expect(page.getByText('No compass on this device')).toBeVisible({ timeout: 10_000 });
  await expect(page.getByRole('radio', { name: 'Sky' })).toHaveAttribute('aria-checked', 'true');
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
