import { db } from './db';

/** Settings → Display. Day is Ionic's high-contrast palette, for direct sunlight (§5). */
export type Theme = 'auto' | 'light' | 'dark' | 'night';

export async function loadTheme(): Promise<Theme> {
  return ((await (await db()).get('settings', 'theme')) as Theme | undefined) ?? 'auto';
}

export async function saveTheme(t: Theme): Promise<void> {
  await (await db()).put('settings', t, 'theme');
}

let media: MediaQueryList | null = null;
let current: Theme = 'auto';

function paint() {
  const root = document.documentElement.classList;
  const systemDark = media?.matches ?? false;
  root.toggle('ion-palette-high-contrast', current === 'light');
  root.toggle('ion-palette-dark', current === 'dark' || current === 'night' || (current === 'auto' && systemDark));
  root.toggle('pb-night', current === 'night');
}

export function applyTheme(t: Theme): void {
  current = t;
  if (!media && typeof window !== 'undefined' && window.matchMedia) {
    media = window.matchMedia('(prefers-color-scheme: dark)');
    media.addEventListener('change', paint);
  }
  paint();
}
