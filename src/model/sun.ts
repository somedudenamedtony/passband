// D10 sun calibration: where the sun is, from satellite.js's solar ephemeris.

import { degreesToRadians, ecfToLookAngles, eciToEcf, gstime, radiansToDegrees, sunPos } from 'satellite.js';
import type { Pointing } from './orientation';

const KM_PER_AU = 149_597_870.7; // lint-allow-number: astronomical unit in km — not a frequency
const JD_UNIX_EPOCH = 2440587.5;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

export function sunPosition(t: number, latDeg: number, lonDeg: number): Pointing {
  const jd = t / MS_PER_DAY + JD_UNIX_EPOCH;
  const { rsun } = sunPos(jd);
  const eci = { x: rsun.x * KM_PER_AU, y: rsun.y * KM_PER_AU, z: rsun.z * KM_PER_AU };
  const la = ecfToLookAngles(
    { latitude: degreesToRadians(latDeg), longitude: degreesToRadians(lonDeg), height: 0 },
    eciToEcf(eci, gstime(jd)),
  );
  return { azDeg: (radiansToDegrees(la.azimuth) + 360) % 360, elDeg: radiansToDegrees(la.elevation) };
}
