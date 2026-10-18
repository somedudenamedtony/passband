// D20: the model is SI. These formatters are the only place miles and feet exist.

import type { Station } from './types';

type Units = Station['units'];

const METRES_PER_MILE = 1609.344;
const METRES_PER_FOOT = 0.3048;

/** Distances: range, altitude, footprint radius. */
export function formatDistance(metres: number, units: Units): string {
  if (units === 'metric') return `${Math.round(metres / 1000).toLocaleString()} km`;
  return `${Math.round(metres / METRES_PER_MILE).toLocaleString()} mi`;
}

/** Heights: station altitude, antenna height. */
export function formatHeight(metres: number, units: Units): string {
  if (units === 'metric') return `${Math.round(metres).toLocaleString()} m`;
  return `${Math.round(metres / METRES_PER_FOOT).toLocaleString()} ft`;
}

/** Parse a height the user typed in their display unit back into metres. */
export function parseHeight(value: number, units: Units): number {
  return units === 'metric' ? value : value * METRES_PER_FOOT;
}
