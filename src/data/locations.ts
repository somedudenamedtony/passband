// D8: locations never leave the device.

import { gridToLatLon, normaliseGrid, toGrid6 } from '../model/grid';
import { newId } from '../model/ids';
import type { Location } from '../model/types';
import { db } from './db';

export const EMPTY_MASK: readonly number[] = Array.from({ length: 36 }, () => 0);

export function locationFromGrid(name: string, grid: string): Location {
  const { latDeg, lonDeg } = gridToLatLon(grid);
  const g = normaliseGrid(grid);
  return {
    id: newId(),
    name: name.trim() || g.slice(0, 4),
    latDeg,
    lonDeg,
    altM: 0,
    // A 4-character grid is a 1°×2° box; keep what the user typed rather than invent precision.
    grid6: g.length === 6 ? g : toGrid6(latDeg, lonDeg),
    horizonMask: [...EMPTY_MASK],
  };
}

export function locationFromCoords(name: string, latDeg: number, lonDeg: number, altM: number): Location {
  const grid6 = toGrid6(latDeg, lonDeg);
  return { id: newId(), name: name.trim() || grid6.slice(0, 4), latDeg, lonDeg, altM, grid6, horizonMask: [...EMPTY_MASK] };
}

export async function listLocations(): Promise<Location[]> {
  return (await db()).getAll('locations');
}

export async function saveLocation(loc: Location): Promise<void> {
  await (await db()).put('locations', loc);
}

export async function deleteLocation(id: string): Promise<void> {
  await (await db()).delete('locations', id);
}

export async function getActiveLocationId(): Promise<string | null> {
  return ((await (await db()).get('settings', 'activeLocationId')) as string | undefined) ?? null;
}

export async function setActiveLocationId(id: string): Promise<void> {
  await (await db()).put('settings', id, 'activeLocationId');
}
