import { describe, expect, it } from 'vitest';
import fixtures from '../test/fixtures/elements.json';
import { DAY, HOUR, SECOND } from '../model/time';
import type { Location, OmmElements } from '../model/types';
import { findPasses, lookAngle, maskAt, rangeRate, satrecFromOmm } from './passes';

const iss = fixtures.iss as unknown as OmmElements;
const so50 = fixtures.so50 as unknown as OmmElements;
const epochOf = (o: OmmElements) => Date.parse(`${o.EPOCH}Z`);

const seattle: Location = {
  id: 'loc-test',
  name: 'Test',
  latDeg: 47.6062,
  lonDeg: -122.3321,
  altM: 50,
  grid6: 'CN87uo',
  horizonMask: Array.from({ length: 36 }, () => 0),
};

/** Independent reference: 1-second brute-force scan of the same propagator. */
function bruteForce(elements: OmmElements, from: number, to: number) {
  const satrec = satrecFromOmm(elements);
  const out: Array<{ aos: number; los: number; maxEl: number }> = [];
  let prev = lookAngle(satrec, seattle, from)!.elDeg;
  let cur: { aos: number; maxEl: number } | null = null;
  for (let t = from + SECOND; t <= to; t += SECOND) {
    const el = lookAngle(satrec, seattle, t)!.elDeg;
    if (prev <= 0 && el > 0) cur = { aos: t, maxEl: el };
    if (cur && el > cur.maxEl) cur.maxEl = el;
    if (cur && prev > 0 && el <= 0) {
      out.push({ aos: cur.aos, los: t, maxEl: cur.maxEl });
      cur = null;
    }
    prev = el;
  }
  return out;
}

describe('pass search (D3, §10)', () => {
  for (const [name, elements] of [
    ['ISS', iss],
    ['SO-50', so50],
  ] as const) {
    it(`${name}: AOS/LOS within ±2 s and max elevation within ±0.2° of a 1 s scan`, () => {
      const from = epochOf(elements) + 2 * HOUR;
      const to = from + DAY;
      const ref = bruteForce(elements, from, to);
      const found = findPasses({ noradId: 1, elements, elementsEpoch: epochOf(elements) }, seattle, from, to);
      expect(ref.length).toBeGreaterThan(2);
      expect(found.length).toBe(ref.length);
      found.forEach((p, i) => {
        const r = ref[i]!;
        expect(Math.abs(p.aos - r.aos)).toBeLessThanOrEqual(2 * SECOND);
        expect(Math.abs(p.los - r.los)).toBeLessThanOrEqual(2 * SECOND);
        expect(Math.abs(p.maxElDeg - r.maxEl)).toBeLessThanOrEqual(0.2);
        expect(p.tca).toBeGreaterThan(p.aos);
        expect(p.tca).toBeLessThan(p.los);
      });
    });
  }

  it('includes a pass already in progress, with its true AOS', () => {
    const from0 = epochOf(iss) + 2 * HOUR;
    const all = findPasses({ noradId: 1, elements: iss, elementsEpoch: 0 }, seattle, from0, from0 + DAY);
    const p = all[0]!;
    const mid = Math.round((p.aos + p.los) / 2);
    const again = findPasses({ noradId: 1, elements: iss, elementsEpoch: 0 }, seattle, mid, mid + HOUR);
    expect(Math.abs(again[0]!.aos - p.aos)).toBeLessThanOrEqual(2 * SECOND);
    expect(Math.abs(again[0]!.los - p.los)).toBeLessThanOrEqual(2 * SECOND);
  });

  it('range rate is negative before TCA and positive after', () => {
    const from = epochOf(iss) + 2 * HOUR;
    const p = findPasses({ noradId: 1, elements: iss, elementsEpoch: 0 }, seattle, from, from + DAY)[0]!;
    const satrec = satrecFromOmm(iss);
    expect(rangeRate(satrec, seattle, p.aos + 30 * SECOND)!).toBeLessThan(0);
    expect(rangeRate(satrec, seattle, p.los - 30 * SECOND)!).toBeGreaterThan(0);
  });

  it('judges a pass on the part that clears the horizon mask (D9)', () => {
    const from = epochOf(iss) + 2 * HOUR;
    const open = findPasses({ noradId: 1, elements: iss, elementsEpoch: 0 }, seattle, from, from + DAY);
    const trees = { ...seattle, horizonMask: Array.from({ length: 36 }, () => 15) };
    const masked = findPasses({ noradId: 1, elements: iss, elementsEpoch: 0 }, trees, from, from + DAY);
    expect(masked.length).toBe(open.length);
    masked.forEach((p, i) => {
      expect(p.visibleSecondsAboveMask).toBeLessThan(open[i]!.visibleSecondsAboveMask);
      if (p.maxElDeg < 15) expect(p.visibleSecondsAboveMask).toBe(0);
    });
  });

  it('reads the mask by 10° sector', () => {
    const mask = Array.from({ length: 36 }, (_, i) => i);
    expect(maskAt(mask, 0)).toBe(0);
    expect(maskAt(mask, 215)).toBe(21);
    expect(maskAt(mask, 359.9)).toBe(35);
    expect(maskAt(mask, -10)).toBe(35);
  });
});
