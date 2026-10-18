import { describe, expect, it } from 'vitest';
import { circle, footprintRadiusM, reachableGrids, splitAtAntimeridian } from './footprint';
import { toIcs } from './ics';

describe('calendar export (D17)', () => {
  const ics = toIcs(
    [
      {
        uid: '27607-1@passband',
        start: Date.UTC(2026, 9, 18, 21, 4, 30),
        end: Date.UTC(2026, 9, 18, 21, 16, 0),
        summary: 'SO-50 pass, up to 47°',
        description: 'Listen 436.795, transmit 145.850; tone 67.0 Hz.\nRises in the south-west, sets in the north-east.',
      },
    ],
    Date.UTC(2026, 9, 18, 12),
  );
  it('is a calendar with UTC times and an alarm 5 minutes before AOS', () => {
    expect(ics.startsWith('BEGIN:VCALENDAR\r\n')).toBe(true);
    expect(ics).toContain('DTSTART:20261018T210430Z');
    expect(ics).toContain('DTEND:20261018T211600Z');
    expect(ics).toContain('TRIGGER:-PT5M');
    expect(ics.trimEnd().endsWith('END:VCALENDAR')).toBe(true);
  });
  it('escapes text and folds long lines at 75 octets', () => {
    for (const line of ics.split('\r\n')) expect(new TextEncoder().encode(line).length).toBeLessThanOrEqual(75);
    const unfolded = ics.replace(/\r\n /g, '');
    expect(unfolded).toContain(
      'DESCRIPTION:Listen 436.795\\, transmit 145.850\; tone 67.0 Hz.\\nRises in the south-west\\, sets in the north-east.',
    );
  });
});

describe('footprint (§5.3)', () => {
  it('ISS at 420 km sees about 2,250 km to the edge', () => {
    const r = footprintRadiusM(420_000);
    expect(r).toBeGreaterThan(2_200_000);
    expect(r).toBeLessThan(2_300_000);
  });
  it('draws a closed circle and splits at the antimeridian', () => {
    const c = circle(0, 179, 0.3, 64);
    expect(c[0]![0]).toBeCloseTo(c[c.length - 1]![0]);
    expect(splitAtAntimeridian(c).length).toBeGreaterThan(1);
    expect(splitAtAntimeridian(circle(47, -122, 0.3)).length).toBe(1);
  });
  it('a rover reaches grids within two footprint radii, not across the world', () => {
    const grids = reachableGrids(47.5, -123, 800_000);
    expect(grids).toContain('CN87');
    expect(grids).toContain('DM79'); // Denver, about 1,650 km away
    expect(grids).not.toContain('JO01'); // London
  });
});
