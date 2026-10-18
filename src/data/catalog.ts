// D4: fetch catalog.json from our own origin when online; keep the last good copy on device.

import type { Catalog } from '../model/types';
import { db } from './db';

export interface LoadedCatalog {
  catalog: Catalog;
  /** True when this came from the device because the network copy wasn't reachable. */
  fromCache: boolean;
}

function looksValid(c: unknown): c is Catalog {
  const x = c as Catalog;
  return typeof x?.generatedAt === 'number' && Array.isArray(x.satellites) && x.satellites.length > 0;
}

export async function cachedCatalog(): Promise<Catalog | null> {
  return (await (await db()).get('catalog', 'current')) ?? null;
}

export async function loadCatalog(): Promise<LoadedCatalog | null> {
  const cached = await cachedCatalog();
  try {
    // D2: relative to Vite's base, never '/'.
    const res = await fetch(`${import.meta.env.BASE_URL}catalog.json`, { cache: 'no-cache' });
    if (!res.ok) throw new Error(`catalog ${res.status}`);
    const fresh: unknown = await res.json();
    if (!looksValid(fresh)) throw new Error('catalog malformed');
    // Never replace a newer copy with an older one (e.g. a stale CDN edge).
    if (!cached || fresh.generatedAt >= cached.generatedAt) {
      await (await db()).put('catalog', fresh, 'current');
      return { catalog: fresh, fromCache: false };
    }
    return { catalog: cached, fromCache: false };
  } catch {
    return cached ? { catalog: cached, fromCache: true } : null;
  }
}
