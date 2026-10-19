import { expect, test, type Page } from '@playwright/test';

test.use({ hasTouch: true, viewport: { width: 390, height: 844 } });

// Run as if installed on the home screen: the edge swipe is only on in that display mode.
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    const real = window.matchMedia.bind(window);
    window.matchMedia = (q: string) =>
      q.includes('display-mode: standalone') ? ({ ...real(q), matches: true, media: q } as MediaQueryList) : real(q);
  });
});

/** A finger dragging in from the left edge, as a series of real touch events. */
async function edgeSwipe(page: Page) {
  await page.evaluate(async () => {
    const at = (x: number) =>
      new Touch({ identifier: 1, target: document.body, clientX: x, clientY: 400 });
    const fire = (type: string, x: number) =>
      document.dispatchEvent(
        new TouchEvent(type, { touches: type === 'touchend' ? [] : [at(x)], changedTouches: [at(x)], bubbles: true }),
      );
    fire('touchstart', 4);
    for (const x of [30, 60, 90, 120]) {
      fire('touchmove', x);
      await new Promise((r) => requestAnimationFrame(r));
    }
    fire('touchend', 120);
  });
}

test('swiping in from the left edge goes back', async ({ page }) => {
  await page.goto('./');
  await page.getByPlaceholder('CN87uo').fill('CN87uo');
  await page.getByRole('button', { name: 'Show my passes' }).click();
  await page.getByRole('heading', { name: 'Next 24 hours' }).waitFor({ timeout: 30_000 });

  // A sheet closes.
  await page.getByRole('button', { name: 'Settings' }).click();
  await expect(page.getByRole('dialog', { name: 'Settings' })).toBeVisible();
  await edgeSwipe(page);
  await expect(page.getByRole('dialog')).toHaveCount(0);

  // The previous tab comes back.
  await page.getByRole('tab', { name: 'Map', exact: true }).click();
  await page.getByRole('tab', { name: 'Log', exact: true }).click();
  await edgeSwipe(page);
  await expect(page.getByRole('tab', { name: 'Map', exact: true })).toHaveAttribute('aria-selected', 'true');
  await edgeSwipe(page);
  await expect(page.getByRole('tab', { name: 'Tonight', exact: true })).toHaveAttribute('aria-selected', 'true');

  // The live screen closes.
  await page.getByRole('button', { name: /^(Start|Track it now)$/ }).click();
  await expect(page.getByRole('dialog', { name: 'Live pass' })).toBeVisible();
  await edgeSwipe(page);
  await expect(page.getByRole('dialog', { name: 'Live pass' })).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'Next 24 hours' })).toBeVisible();
});
