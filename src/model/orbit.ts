// The orbit at a glance, from the OMM mean elements (D4). Metres and seconds (D20).

import type { OmmElements } from './types';

const MU = 3.986004418e14; // m³/s², Earth's gravitational parameter. lint-allow-number: a physical constant, not a frequency
const EARTH_RADIUS_M = 6_378_137; // WGS-84 equatorial

export interface OrbitSummary {
  periodS: number;
  inclinationDeg: number;
  perigeeM: number;
  apogeeM: number;
}

export function orbitSummary(el: OmmElements): OrbitSummary | null {
  const revsPerDay = Number(el.MEAN_MOTION);
  const e = Number(el.ECCENTRICITY);
  const inclinationDeg = Number(el.INCLINATION);
  if (!(revsPerDay > 0) || !Number.isFinite(e) || !Number.isFinite(inclinationDeg)) return null;
  const periodS = 86_400 / revsPerDay;
  const n = (2 * Math.PI) / periodS; // rad/s
  const a = Math.cbrt(MU / (n * n));
  return { periodS, inclinationDeg, perigeeM: a * (1 - e) - EARTH_RADIUS_M, apogeeM: a * (1 + e) - EARTH_RADIUS_M };
}
