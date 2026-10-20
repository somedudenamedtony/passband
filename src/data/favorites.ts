// Favorite satellites, by NORAD id. On this device only, like everything user-owned (D1, §7):
// no account, nothing sent anywhere.

import { db } from './db';

export async function loadFavorites(): Promise<Set<number>> {
  const ids = (await (await db()).get('settings', 'favorites')) as number[] | undefined;
  return new Set(ids ?? []);
}

export async function saveFavorites(favorites: ReadonlySet<number>): Promise<void> {
  await (await db()).put('settings', [...favorites].sort((a, b) => a - b), 'favorites');
}
