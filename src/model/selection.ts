// D19: experience changes defaults only. Nothing here hides a satellite the user asks for.

import { hasWorkingUplink } from './transmitters';
import { passOutlook } from './outlook';
import type { Catalog, Hours, Pass, Satellite, Station } from './types';

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
    (s) =>
      (opts.showInactive || (s.status !== 'inactive' && !isUnidentified(s))) &&
      (opts.showAll || isDefaultListed(s, experience) || fav(s)),
  );
}

/**
 * Objects SatNOGS hasn't identified yet ("Unknown Satellite", "Unknown 2 - T16"): nobody can
 * plan around them, so they only show under + Inactive (everything), or as a favorite.
 */
export function isUnidentified(sat: Satellite): boolean {
  return !sat.overlay.curated && /^unknown\b/i.test(sat.name);
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

/**
 * The pass for the big card: the soonest good pass that will probably be on (outlook.ts), during
 * the user's hours if one falls in them. Passes judged unlikely (schedule only, in shadow, quiet
 * lately) never take the card; they stay in the lists, marked. Likely beats uncertain.
 */
export function nextGoodPass(
  passes: readonly Pass[],
  sats: ReadonlyMap<number, Satellite>,
  experience: Station['experience'],
  now: number,
  hours: Hours | null = null,
): Pass | null {
  const good = passes.filter((p) => {
    const s = sats.get(p.noradId);
    return p.los > now && s !== undefined && s.status !== 'inactive' && isGoodPass(p, experience);
  });
  const level = (p: Pass) => passOutlook(p, sats.get(p.noradId)!, now).level;
  const awake = (p: Pass) => inHours(p.aos, hours) || (p.aos <= now && p.los > now);
  return (
    good.find((p) => awake(p) && level(p) === 'likely') ??
    good.find((p) => awake(p) && level(p) === 'uncertain') ??
    good.find((p) => level(p) === 'likely') ??
    good.find((p) => level(p) === 'uncertain') ??
    null
  );
}

export function samePass(a: Pass | null, b: Pass | null): boolean {
  return a !== null && b !== null && a.noradId === b.noradId && a.aos === b.aos;
}

/**
 * §5.5 "picking the pass" for a first contact: the same rule as the Tonight card (nextGoodPass,
 * judged as a beginner), over beginner FM satellites only, so Learn and Tonight agree.
 */
export function easiestPass(
  passes: readonly Pass[],
  sats: ReadonlyMap<number, Satellite>,
  now: number,
  hours: Hours | null = null,
): Pass | null {
  const fm = new Map(
    [...sats].filter(
      ([, s]) => s.overlay.difficulty === 'beginner' && s.transmitters.some((t) => t.kind === 'fm_repeater' && t.status !== 'inactive'),
    ),
  );
  return nextGoodPass(
    passes.filter((p) => p.aos > now),
    fm,
    'new',
    now,
    hours,
  );
}

/** True when t (UTC ms) falls in the user's hours, read in local time. null hours = any time. */
export function inHours(t: number, hours: Hours | null): boolean {
  if (!hours) return true;
  const d = new Date(t);
  const m = d.getHours() * 60 + d.getMinutes();
  return hours.fromMin <= hours.toMin ? m >= hours.fromMin && m < hours.toMin : m >= hours.fromMin || m < hours.toMin;
}
