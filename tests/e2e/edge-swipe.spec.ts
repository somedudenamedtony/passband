import { expect, test, type Page } from '@playwright/test';
import { openFuturePass, openNextLive, setup } from './v2';

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
  await setup(page);

  // A sheet closes.
  await page.getByRole('button', { name: /^Location: / }).click();
  await expect(page.getByRole('dialog', { name: 'Locations' })).toBeVisible();
  await edgeSwipe(page);
  await expect(page.getByRole('dialog')).toHaveCount(0);

  // The previous tab comes back.
  await page.getByRole('tab', { name: 'Plan', exact: true }).click();
  await page.getByRole('tab', { name: 'Log', exact: true }).click();
  await edgeSwipe(page);
  await expect(page.getByRole('tab', { name: 'Plan', exact: true })).toHaveAttribute('aria-selected', 'true');
  await edgeSwipe(page);
  await expect(page.getByRole('tab', { name: 'Now', exact: true })).toHaveAttribute('aria-selected', 'true');

  // A pass goes back to Now, and the live screen closes to its pass.
  await openFuturePass(page);
  await edgeSwipe(page);
  await expect(page.getByRole('tab', { name: 'Now', exact: true })).toHaveAttribute('aria-selected', 'true');
  await openNextLive(page);
  await expect(page.getByRole('dialog', { name: 'Live pass' })).toBeVisible();
  await edgeSwipe(page);
  await expect(page.getByRole('dialog', { name: 'Live pass' })).toHaveCount(0);
});
