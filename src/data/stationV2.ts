// The v2 station (SPEC-v2 D19). Until the v1 screens go (R4) it is derived from the v1 station the
// first time it's read, and My satellites stays in the shared 'favorites' setting, so a star set in
// either app shows in both.

import { migrateStation, type StationV2 } from '../model/stationV2';
import { db } from './db';
import { loadFavorites, saveFavorites } from './favorites';
import { loadStation } from './station';

export async function loadStationV2(): Promise<StationV2> {
  const [stored, favorites] = await Promise.all([
    (await db()).get('settings', 'stationV2') as Promise<Omit<StationV2, 'mySatellites'> | undefined>,
    loadFavorites(),
  ]);
  const mySatellites = [...favorites].sort((a, b) => a - b);
  if (stored) return { ...stored, mySatellites };
  return migrateStation(await loadStation(), mySatellites);
}

export async function saveStationV2(s: StationV2): Promise<void> {
  const { mySatellites, ...rest } = s;
  await (await db()).put('settings', rest, 'stationV2');
  await saveFavorites(new Set(mySatellites));
}
