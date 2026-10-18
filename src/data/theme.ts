import { db } from './db';

/**
 * Settings → Display (§5). The panel comes in three finishes:
 *   Dark — black chassis, amber backlit LCD (the default at night and in Auto on a dark phone)
 *   Day  — light chassis, unlit reflective LCD: high contrast in direct sun
 *   Red  — night mode, red on black only, to keep dark adaptation
 * Auto follows the phone between Day and Dark.
 */
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
  const systemDark = media?.matches ?? true;
  const finish = current === 'auto' ? (systemDark ? 'dark' : 'day') : current === 'light' ? 'day' : current;
  document.documentElement.dataset.finish = finish;
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', getComputedStyle(document.documentElement).getPropertyValue('--chassis').trim() || '#1b1e20');
}

export function applyTheme(t: Theme): void {
  current = t;
  if (!media && typeof window !== 'undefined' && window.matchMedia) {
    media = window.matchMedia('(prefers-color-scheme: dark)');
    media.addEventListener('change', paint);
  }
  paint();
}
