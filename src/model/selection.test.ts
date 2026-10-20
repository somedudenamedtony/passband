import { describe, expect, it } from 'vitest';
import { listedSatellites, toggleFavorite } from './selection';
import type { Catalog, Satellite } from './types';

function sat(noradId: number, difficulty: Satellite['overlay']['difficulty'], status: Satellite['status'] = 'active'): Satellite {
  return {
    noradId,
    name: `S${noradId}`,
    lotwName: null,
    status,
    elements: {} as Satellite['elements'],
    elementsEpoch: 0,
    elementsSource: 'celestrak-omm',
    transmitters: [],
    overlay: { curated: difficulty !== null, difficulty, note: null, receiveOnly: false },
  };
}

const catalog: Catalog = { generatedAt: 0, satellites: [sat(1, 'beginner'), sat(2, null), sat(3, null, 'inactive')] };
const ids = (l: Satellite[]) => l.map((s) => s.noradId);

describe('unidentified objects', () => {
  it('stay out of All active but are listed under everything', () => {
    const unknown = { ...sat(9, null), name: 'Unknown 2 - T16' };
    const c: Catalog = { generatedAt: 0, satellites: [sat(2, null), unknown] };
    expect(ids(listedSatellites(c, 'new', { showAll: true, showInactive: false }))).toEqual([2]);
    expect(ids(listedSatellites(c, 'new', { showAll: true, showInactive: true }))).toEqual([2, 9]);
  });
});

describe('favorites', () => {
  it('join the default list without an account or a server, just a set of ids', () => {
    const base = { showAll: false, showInactive: false };
    expect(ids(listedSatellites(catalog, 'new', base))).toEqual([1]);
    expect(ids(listedSatellites(catalog, 'new', { ...base, favorites: new Set([2]) }))).toEqual([1, 2]);
  });

  it('can be listed on their own, inactive ones included', () => {
    const only = { showAll: false, showInactive: false, onlyFavorites: true, favorites: new Set([2, 3]) };
    expect(ids(listedSatellites(catalog, 'new', only))).toEqual([2, 3]);
  });

  it('toggle on and off without changing the original set', () => {
    const a = new Set([1]);
    const b = toggleFavorite(a, 2);
    expect([...b]).toEqual([1, 2]);
    expect([...toggleFavorite(b, 1)]).toEqual([2]);
    expect([...a]).toEqual([1]);
  });
});
