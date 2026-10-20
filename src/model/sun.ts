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

const EARTH_RADIUS_KM = 6378.137;

/**
 * True when a satellite at this ECI position (km) is in the Earth's shadow. A cylindrical shadow
 * is plenty for "is a battery-starved bird on?": the penumbra lasts seconds at LEO.
 */
export function inEarthShadow(posEciKm: { x: number; y: number; z: number }, t: number): boolean {
  const { rsun } = sunPos(t / MS_PER_DAY + JD_UNIX_EPOCH);
  const n = Math.hypot(rsun.x, rsun.y, rsun.z);
  const s = { x: rsun.x / n, y: rsun.y / n, z: rsun.z / n };
  const along = posEciKm.x * s.x + posEciKm.y * s.y + posEciKm.z * s.z;
  if (along >= 0) return false;
  const px = posEciKm.x - along * s.x;
  const py = posEciKm.y - along * s.y;
  const pz = posEciKm.z - along * s.z;
  return Math.hypot(px, py, pz) < EARTH_RADIUS_KM;
}
