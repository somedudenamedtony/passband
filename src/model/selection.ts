// D19: experience changes defaults only. Nothing here hides a satellite the user asks for.

import { hasWorkingUplink } from './transmitters';
import type { Catalog, Pass, Satellite, Station } from './types';

export interface ListOptions {
  /** Every in-scope satellite, not just the experience default. */
  showAll: boolean;
  showInactive: boolean;
}

export function isDefaultListed(sat: Satellite, experience: Station['experience']): boolean {
  if (experience === 'new') return sat.overlay.difficulty === 'beginner' || sat.overlay.receiveOnly;
  return hasWorkingUplink(sat) || sat.overlay.receiveOnly;
}

export function listedSatellites(catalog: Catalog, experience: Station['experience'], opts: ListOptions): Satellite[] {
  return catalog.satellites.filter(
    (s) => (opts.showInactive || s.status !== 'inactive') && (opts.showAll || isDefaultListed(s, experience)),
  );
}

/** "Should I bother?" A pass worth getting up for, judged on the part above the mask (D9). */
export function isGoodPass(pass: Pass, experience: Station['experience']): boolean {
  const minEl = experience === 'new' ? 25 : 10;
  return pass.maxElDeg >= minEl && pass.visibleSecondsAboveMask >= 120;
}

export function nextGoodPass(
  passes: readonly Pass[],
  sats: ReadonlyMap<number, Satellite>,
  experience: Station['experience'],
  now: number,
): Pass | null {
  return (
    passes.find((p) => {
      const s = sats.get(p.noradId);
      return p.los > now && s !== undefined && s.status !== 'inactive' && isGoodPass(p, experience);
    }) ?? null
  );
}

export function samePass(a: Pass | null, b: Pass | null): boolean {
  return a !== null && b !== null && a.noradId === b.noradId && a.aos === b.aos;
}
