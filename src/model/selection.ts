import { HOUR } from './time';
// D19: experience changes defaults only. Nothing here hides a satellite the user asks for.

import { hasWorkingUplink } from './transmitters';
import type { Catalog, Pass, Satellite, Station } from './types';

export interface ListOptions {
  /** Every in-scope satellite, not just the experience default. */
  showAll: boolean;
  showInactive: boolean;
  /** The user's favorites (NORAD ids): always part of the default list. */
  favorites?: ReadonlySet<number>;
  /** Only the favorites, dead or alive: the user picked them. */
  onlyFavorites?: boolean;
}

export function isDefaultListed(sat: Satellite, experience: Station['experience']): boolean {
  if (experience === 'new') return sat.overlay.difficulty === 'beginner' || sat.overlay.receiveOnly;
  return hasWorkingUplink(sat) || sat.overlay.receiveOnly;
}

export function listedSatellites(catalog: Catalog, experience: Station['experience'], opts: ListOptions): Satellite[] {
  const fav = (s: Satellite) => opts.favorites?.has(s.noradId) ?? false;
  if (opts.onlyFavorites) return catalog.satellites.filter(fav);
  return catalog.satellites.filter(
    (s) => (opts.showInactive || s.status !== 'inactive') && (opts.showAll || isDefaultListed(s, experience) || fav(s)),
  );
}

/** Add or remove one favorite, returning a new set. */
export function toggleFavorite(favorites: ReadonlySet<number>, noradId: number): Set<number> {
  const next = new Set(favorites);
  if (next.has(noradId)) next.delete(noradId);
  else next.add(noradId);
  return next;
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

/**
 * §5.5 "picking the pass": the easiest coming pass for a first contact. Beginner FM satellites
 * only; the highest pass in the next 12 hours (a high pass is longer, stronger and easier to
 * point at), falling back to the next 24 if nothing good comes sooner.
 */
export function easiestPass(passes: readonly Pass[], sats: ReadonlyMap<number, Satellite>, now: number): Pass | null {
  const candidates = passes.filter((p) => {
    const s = sats.get(p.noradId);
    return (
      s !== undefined &&
      p.aos > now &&
      s.status !== 'inactive' &&
      s.overlay.difficulty === 'beginner' &&
      s.transmitters.some((t) => t.kind === 'fm_repeater' && t.status !== 'inactive') &&
      isGoodPass(p, 'new')
    );
  });
  const best = (list: Pass[]) => list.reduce<Pass | null>((b, p) => (!b || p.maxElDeg > b.maxElDeg ? p : b), null);
  return best(candidates.filter((p) => p.aos < now + 12 * HOUR)) ?? best(candidates);
}
