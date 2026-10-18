// Renders public/icon.svg to the PNG sizes the manifest needs. Run once after changing the icon:
//   npx tsx scripts/make-icons.ts   (set PW_CHROMIUM_PATH if Playwright's browser isn't installed)

import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';

const pub = join(dirname(fileURLToPath(import.meta.url)), '..', 'public');

async function main() {
  const svg = await readFile(join(pub, 'icon.svg'), 'utf8');
  const browser = await chromium.launch(
    process.env.PW_CHROMIUM_PATH ? { executablePath: process.env.PW_CHROMIUM_PATH } : {},
  );
  const page = await browser.newPage();
  const shots: Array<[string, number, number]> = [
    ['icon-192.png', 192, 192],
    ['icon-512.png', 512, 512],
    // Maskable: keep the artwork inside the 80% safe zone.
    ['icon-512-maskable.png', 512, 400],
  ];
  for (const [name, size, art] of shots) {
    await page.setViewportSize({ width: size, height: size });
    await page.setContent(
      `<body style="margin:0;background:#0b1220;display:grid;place-items:center;height:${size}px">
        <div style="width:${art}px;height:${art}px">${svg.replace('<svg ', '<svg width="100%" height="100%" ')}</div>
      </body>`,
    );
    await page.screenshot({ path: join(pub, name), omitBackground: size === art });
  }
  await browser.close();
}

void main();
