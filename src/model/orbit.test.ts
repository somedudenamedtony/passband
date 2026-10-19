import { describe, expect, it } from 'vitest';
import fixtures from '../test/fixtures/elements.json';
import { orbitSummary } from './orbit';
import type { OmmElements } from './types';

describe('orbitSummary', () => {
  it('puts the ISS about 400 km up on a 92-minute, 51.6° orbit', () => {
    const o = orbitSummary(fixtures.iss as unknown as OmmElements)!;
    expect(o.periodS / 60).toBeGreaterThan(90);
    expect(o.periodS / 60).toBeLessThan(94);
    expect(o.inclinationDeg).toBeCloseTo(51.6, 0);
    expect(o.perigeeM).toBeGreaterThan(350_000);
    expect(o.apogeeM).toBeLessThan(450_000);
    expect(o.apogeeM).toBeGreaterThanOrEqual(o.perigeeM);
  });

  it('refuses elements without a mean motion', () => {
    expect(orbitSummary({} as OmmElements)).toBeNull();
  });
});
