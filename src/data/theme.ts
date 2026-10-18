import { db } from './db';

export type Theme = 'auto' | 'light' | 'dark' | 'night';

export async function loadTheme(): Promise<Theme> {
  return ((await (await db()).get('settings', 'theme')) as Theme | undefined) ?? 'auto';
}

export async function saveTheme(t: Theme): Promise<void> {
  await (await db()).put('settings', t, 'theme');
}

export function applyTheme(t: Theme): void {
  if (t === 'auto') delete document.documentElement.dataset.theme;
  else document.documentElement.dataset.theme = t;
}
