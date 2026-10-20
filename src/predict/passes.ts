// D3: pass search. Pure functions; the worker (worker.ts) is a thin shell around these.

import {
  degreesLat,
  degreesLong,
  degreesToRadians,
  ecfToLookAngles,
  eciToEcf,
  eciToGeodetic,
  gstime,
  json2satrec,
  propagate,
  radiansToDegrees,
  type SatRec,
} from 'satellite.js';
import type { Location, OmmElements, Pass } from '../model/types';
import { SECOND } from '../model/time';
import type { TrackPoint } from '../model/track';
import { inEarthShadow } from '../model/sun';

const COARSE_STEP = 30 * SECOND;
const MASK_STEP = 5 * SECOND;

export interface Observer {
  latDeg: number;
  lonDeg: number;
  altM: number;
}

export interface LookAngle {
  azDeg: number;
  elDeg: number;
  /** metres */
  rangeM: number;
}

export interface SubPoint {
  latDeg: number;
  lonDeg: number;
  /** metres */
  altM: number;
}

export function satrecFromOmm(omm: OmmElements): SatRec {
  return json2satrec(omm);
}

function geodetic(obs: Observer) {
  return {
    latitude: degreesToRadians(obs.latDeg),
    longitude: degreesToRadians(obs.lonDeg),
    height: obs.altM / 1000,
  };
}

/** Look angles at time t, or null if SGP4 fails (decayed, bad elements). */
export function lookAngle(satrec: SatRec, obs: Observer, t: number): LookAngle | null {
  const date = new Date(t);
  const pv = propagate(satrec, date);
  if (!pv) return null;
  const ecf = eciToEcf(pv.position, gstime(date));
  const la = ecfToLookAngles(geodetic(obs), ecf);
  return {
    azDeg: (radiansToDegrees(la.azimuth) + 360) % 360,
    elDeg: radiansToDegrees(la.elevation),
    rangeM: la.rangeSat * 1000,
  };
}

/** Range rate in m/s, positive when moving away (D7). Central difference over one second. */
export function rangeRate(satrec: SatRec, obs: Observer, t: number): number | null {
  const a = lookAngle(satrec, obs, t - SECOND / 2);
  const b = lookAngle(satrec, obs, t + SECOND / 2);
  if (!a || !b) return null;
  return b.rangeM - a.rangeM;
}

export function subPoint(satrec: SatRec, t: number): SubPoint | null {
  const date = new Date(t);
  const pv = propagate(satrec, date);
  if (!pv) return null;
  const gd = eciToGeodetic(pv.position, gstime(date));
  return { latDeg: degreesLat(gd.latitude), lonDeg: degreesLong(gd.longitude), altM: gd.height * 1000 };
}

function elevation(satrec: SatRec, obs: Observer, t: number): number {
  return lookAngle(satrec, obs, t)?.elDeg ?? Number.NaN;
}

/** Bisect to the second for the time where elevation crosses zero between lo and hi. */
function bisectCrossing(satrec: SatRec, obs: Observer, lo: number, hi: number, rising: boolean): number {
  while (hi - lo > SECOND / 4) {
    const mid = (lo + hi) / 2;
    const above = elevation(satrec, obs, mid) > 0;
    if (above === rising) hi = mid;
    else lo = mid;
  }
  return Math.round((lo + hi) / 2);
}

/** Golden-section search for maximum elevation on [a, b]. */
function goldenMax(satrec: SatRec, obs: Observer, a: number, b: number): { t: number; el: number } {
  const g = (Math.sqrt(5) - 1) / 2;
  let c = b - g * (b - a);
  let d = a + g * (b - a);
  let fc = elevation(satrec, obs, c);
  let fd = elevation(satrec, obs, d);
  while (b - a > SECOND / 4) {
    if (fc > fd) {
      b = d;
      d = c;
      fd = fc;
      c = b - g * (b - a);
      fc = elevation(satrec, obs, c);
    } else {
      a = c;
      c = d;
      fc = fd;
      d = a + g * (b - a);
      fd = elevation(satrec, obs, d);
    }
  }
  const t = Math.round((a + b) / 2);
  return { t, el: elevation(satrec, obs, t) };
}

/** D9: the minimum elevation the mask demands at this azimuth. */
export function maskAt(mask: readonly number[], azDeg: number): number {
  const i = Math.floor((((azDeg % 360) + 360) % 360) / 10);
  return mask[i] ?? 0;
}

function secondsAboveMask(satrec: SatRec, obs: Observer, mask: readonly number[], aos: number, los: number): number {
  if (mask.every((m) => m <= 0)) return Math.round((los - aos) / SECOND);
  let ms = 0;
  for (let t = aos; t < los; t += MASK_STEP) {
    const la = lookAngle(satrec, obs, t + MASK_STEP / 2);
    if (la && la.elDeg > maskAt(mask, la.azDeg)) ms += Math.min(MASK_STEP, los - t);
  }
  return Math.round(ms / SECOND);
}

/** Share of [aos, los] with the satellite in sunlight, sampled every 30 s; null if SGP4 fails. */
export function sunlitFraction(satrec: SatRec, aos: number, los: number): number | null {
  let lit = 0;
  let n = 0;
  for (let t = aos; t <= los; t += COARSE_STEP) {
    const pv = propagate(satrec, new Date(t));
    if (!pv) return null;
    n++;
    if (!inEarthShadow(pv.position, t)) lit++;
  }
  return n === 0 ? null : lit / n;
}

export interface PassSearch {
  noradId: number;
  elements: OmmElements;
  elementsEpoch: number;
}

/**
 * Every pass with AOS or LOS inside [from, to]. A pass already in progress at `from` is included
 * with its true AOS (searched backwards), so the live card can show it.
 */
export function findPasses(sat: PassSearch, loc: Location, from: number, to: number): Pass[] {
  const satrec = satrecFromOmm(sat.elements);
  const obs: Observer = loc;
  const passes: Pass[] = [];

  let t = from;
  let el = elevation(satrec, obs, t);
  if (Number.isNaN(el)) return passes;

  // In progress at `from`: walk back to find the real AOS (bounded at one hour).
  let aosLo: number | null = null;
  if (el > 0) {
    let back = from;
    while (back > from - 60 * 60 * SECOND && elevation(satrec, obs, back - COARSE_STEP) > 0) back -= COARSE_STEP;
    aosLo = back - COARSE_STEP;
  }

  let aos: number | null = aosLo === null ? null : bisectCrossing(satrec, obs, aosLo, aosLo + COARSE_STEP, true);
  let prevT = t;
  let prevEl = el;

  while (t < to || aos !== null) {
    t += COARSE_STEP;
    el = elevation(satrec, obs, t);
    if (Number.isNaN(el)) break;
    if (prevEl <= 0 && el > 0) {
      aos = bisectCrossing(satrec, obs, prevT, t, true);
    } else if (prevEl > 0 && el <= 0 && aos !== null) {
      const los = bisectCrossing(satrec, obs, prevT, t, false);
      const peak = goldenMax(satrec, obs, aos, los);
      const aosLook = lookAngle(satrec, obs, aos);
      const losLook = lookAngle(satrec, obs, los);
      if (aosLook && losLook) {
        passes.push({
          noradId: sat.noradId,
          locationId: loc.id,
          aos,
          tca: peak.t,
          los,
          maxElDeg: peak.el,
          aosAzDeg: aosLook.azDeg,
          losAzDeg: losLook.azDeg,
          visibleSecondsAboveMask: secondsAboveMask(satrec, obs, loc.horizonMask, aos, los),
          elementsEpoch: sat.elementsEpoch,
          sunlitFraction: sunlitFraction(satrec, aos, los),
        });
      }
      aos = null;
    }
    prevT = t;
    prevEl = el;
    // Safety: never chase a pass more than 3 hours past the window (GEO or bad elements).
    if (t > to + 3 * 60 * 60 * SECOND) break;
  }
  return passes;
}

/** The pass sampled every `stepMs` from AOS to LOS inclusive, with range rate (D7). */
export function passTrack(elements: OmmElements, obs: Observer, aos: number, los: number, stepMs = SECOND): TrackPoint[] {
  const satrec = satrecFromOmm(elements);
  const pts: TrackPoint[] = [];
  const n = Math.max(1, Math.round((los - aos) / stepMs));
  const step = (los - aos) / n;
  for (let i = 0; i <= n; i++) {
    const t = Math.round(aos + i * step);
    const la = lookAngle(satrec, obs, t);
    const rr = rangeRate(satrec, obs, t);
    if (la && rr !== null) pts.push({ t, ...la, rangeRateMps: rr });
  }
  return pts;
}
