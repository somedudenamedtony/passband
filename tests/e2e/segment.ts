import type { Locator, Page } from '@playwright/test';

/** One key of a segmented control (Sky/Compass/AR, World/Region/Local, practice speed). */
export function segment(scope: Page | Locator, name: string): Locator {
  return scope.getByRole('tab', { name, exact: true });
}
