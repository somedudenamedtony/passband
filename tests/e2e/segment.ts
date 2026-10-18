import type { Locator, Page } from '@playwright/test';

/**
 * An Ionic segment option. The <ion-segment-button> host receives the tap (it overlays its inner
 * native button), so tests click the host, as a finger does.
 */
export function segment(scope: Page | Locator, name: string): Locator {
  return scope.locator('ion-segment-button').filter({ hasText: new RegExp(`^${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`) });
}
