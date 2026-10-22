import { describe, expect, it } from 'vitest';
import { dayPart, direction, passSentence, phaseOf, quality } from './passView';
import { HOUR, MINUTE } from './time';

const T = { fair: 20, great: 45 };

describe('pass at a glance (SPEC-v2 D23, D26)', () => {
  it('grades max elevation against the thresholds', () => {
    expect([10, 20, 44, 45, 80].map((e) => quality(e, T))).toEqual(['low', 'fair', 'fair', 'great', 'great']);
  });

  it('moves through the phases with the clock', () => {
    const p = { aos: 10 * HOUR, los: 10 * HOUR + 10 * MINUTE };
    expect(phaseOf(p, p.aos - 11 * MINUTE)).toBe('before');
    expect(phaseOf(p, p.aos - 9 * MINUTE)).toBe('soon');
    expect(phaseOf(p, p.aos)).toBe('during');
    expect(phaseOf(p, p.los)).toBe('after');
    expect(phaseOf(p, p.los + 2 * HOUR)).toBe('past');
  });

  it('reads rise and set as compass points', () => {
    expect(direction({ aosAzDeg: 225, losAzDeg: 45 })).toBe('SW → NE');
  });

  it('keeps a pre-dawn pass with the night before it', () => {
    const noon = new Date(2026, 9, 22, 12, 0).getTime();
    expect(dayPart(new Date(2026, 9, 22, 15, 0).getTime(), noon, false)).toBe('Today');
    expect(dayPart(new Date(2026, 9, 22, 21, 0).getTime(), noon, true)).toBe('Tonight');
    expect(dayPart(new Date(2026, 9, 23, 2, 0).getTime(), noon, true)).toBe('Tonight');
    expect(dayPart(new Date(2026, 9, 23, 9, 0).getTime(), noon, false)).toBe('Tomorrow');
    expect(dayPart(new Date(2026, 9, 23, 22, 0).getTime(), noon, true)).toBe('Tomorrow night');
  });

  it('says the pass in one sentence', () => {
    const now = 0;
    const pass = { aos: 23 * MINUTE, los: 33 * MINUTE, aosAzDeg: 225, losAzDeg: 45, maxElDeg: 60 };
    expect(passSentence(pass, now, 'great', 'FM voice repeater', 'heard lately')).toBe(
      'Rises in the south-west in 23 min, climbs high, FM voice repeater, heard lately.',
    );
    expect(passSentence(pass, 25 * MINUTE, 'great', 'FM voice repeater', '')).toBe(
      'Up now, sets in the north-east in 8:00, climbs high, FM voice repeater.',
    );
    expect(passSentence(pass, now, 'fair', 'Inverting linear transponder', '')).toContain('climbs part way, inverting linear transponder.');
  });
});
