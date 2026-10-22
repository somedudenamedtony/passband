import { readFile } from 'node:fs/promises';
import { expect, test } from '@playwright/test';

// SPEC-v2 R5: the week ahead; star passes to plan them, filter to the plan, export it in one file.
test('plan two passes this week and export them together', async ({ page }) => {
  await page.goto('./now');
  await page.getByPlaceholder('CN87uo').fill('CN87uo');
  await page.getByRole('button', { name: 'Show my passes' }).click();
  await page.getByRole('tab', { name: 'Plan' }).click();
  await expect(page.locator('.pass-row').first()).toBeVisible({ timeout: 60_000 });
  await expect(page.locator('.plan-sun').first()).toContainText(/☀/);

  const stars = page.getByRole('button', { name: /^Going: / });
  await stars.nth(2).click();
  await stars.nth(5).click();
  await page.getByRole('button', { name: 'Planned only' }).click();
  await expect(page.locator('.pass-row')).toHaveCount(2);

  await page.reload();
  await page.getByRole('button', { name: 'Planned only' }).click();
  await expect(page.locator('.pass-row')).toHaveCount(2, { timeout: 60_000 });

  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Add 2 planned to calendar' }).click();
  const ics = await readFile(await (await download).path(), 'utf8');
  expect(ics.match(/BEGIN:VEVENT/g)).toHaveLength(2);
});
