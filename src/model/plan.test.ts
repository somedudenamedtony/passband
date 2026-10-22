import { describe, expect, it } from 'vitest';
import { clashingIds } from './plan';
import { sunEvents } from './sun';
import { HOUR, MINUTE } from './time';

describe('plans (SPEC-v2 D25)', () => {
  it('flags planned passes that overlap, and ignores ones already done', () => {
    const p = (id: string, aos: number, los: number, outcome: 'planned' | 'worked' = 'planned') => ({ id, aos, los, outcome });
    expect([...clashingIds([p('a', 0, 10), p('b', 5, 15), p('c', 20, 30), p('d', 25, 26, 'worked')])].sort()).toEqual(['a', 'b']);
    expect(clashingIds([p('a', 0, 10), p('b', 10, 20)]).size).toBe(0);
  });
});

describe('sunEvents', () => {
  it('finds one sunrise and one sunset in a day at mid-latitudes', () => {
    // Seattle, 21 June 2026 UTC: sunrise near 12:12 UTC, sunset near 04:10 UTC.
    const from = Date.UTC(2026, 5, 21, 0, 0);
    const ev = sunEvents(from, from + 24 * HOUR, 47.6, -122.3);
    expect(ev.map((e) => e.kind)).toEqual(['set', 'rise']);
    expect(Math.abs(ev[1]!.t - Date.UTC(2026, 5, 21, 12, 12))).toBeLessThan(10 * MINUTE);
  });
});
