import { describe, expect, it } from 'vitest';
import { gridToLatLon, isValidGrid, normaliseGrid, toGrid6 } from './grid';

describe('Maidenhead (D8)', () => {
  it('encodes known locations', () => {
    expect(toGrid6(47.6062, -122.3321)).toBe('CN87uo'); // Seattle
    expect(toGrid6(-33.8688, 151.2093)).toBe('QF56od'); // Sydney
    expect(toGrid6(0, 0)).toBe('JJ00aa');
  });
  it('decodes to the centre of the square and round-trips', () => {
    const c = gridToLatLon('CN87uo');
    expect(toGrid6(c.latDeg, c.lonDeg)).toBe('CN87uo');
    const c4 = gridToLatLon('CN87');
    expect(c4.latDeg).toBeCloseTo(47.5);
    expect(c4.lonDeg).toBeCloseTo(-123);
  });
  it('validates and normalises', () => {
    expect(isValidGrid('cn87')).toBe(true);
    expect(isValidGrid('CN87UO')).toBe(true);
    expect(isValidGrid('CN8')).toBe(false);
    expect(isValidGrid('ZZ99')).toBe(false);
    expect(normaliseGrid(' cn87UO ')).toBe('CN87uo');
  });
  it('clamps the poles and antimeridian', () => {
    expect(toGrid6(90, 180)).toBe('RR99xx');
    expect(toGrid6(-90, -180)).toBe('AA00aa');
  });
});
