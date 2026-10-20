import { describe, expect, it } from 'vitest';
import fixtures from '../test/fixtures/elements.json';
import { findPasses, passTrack } from '../predict/passes';
import { dueCues, passCues, speakableMHz } from './cues';
import { formatMHz } from './freq';
import { retuneSchedule, stepAt } from './schedule';
import { DAY, HOUR, SECOND } from './time';
import { sampleAt, type TrackPoint } from './track';
import type { Location, OmmElements, Transmitter } from './types';

const so50 = fixtures.so50 as unknown as OmmElements;
const loc: Location = {
  id: 'l',
  name: 'Test',
  latDeg: 47.6062,
  lonDeg: -122.3321,
  altM: 0,
  grid6: 'CN87uo',
  horizonMask: Array.from({ length: 36 }, () => 0),
};
// Test fixture values, not shipped frequencies (D6).
const tx: Transmitter = {
  id: 't',
  description: 'test',
  kind: 'fm_repeater',
  uplinkHz: 145_850_000,
  uplinkHighHz: null,
  downlinkHz: 436_795_000,
  downlinkHighHz: null,
  inverting: null,
  mode: 'FM',
  ctcssHz: 67,
  status: 'active',
};

const from = Date.parse(`${so50.EPOCH}Z`) + 2 * HOUR;
const passes = findPasses({ noradId: 27607, elements: so50, elementsEpoch: 0 }, loc, from, from + DAY);
const best = passes.reduce((a, b) => (b.maxElDeg > a.maxElDeg ? b : a));
const track = passTrack(so50, loc, best.aos, best.los);

describe('retune schedule (D7)', () => {
  const sched = retuneSchedule(track, tx, 5000);

  it('starts at AOS with the downlink high, and walks it down through the pass', () => {
    expect(sched.tuneSide).toBe('downlink');
    expect(sched.steps[0]!.t).toBe(best.aos);
    expect(sched.steps[0]!.downlinkHz!).toBeGreaterThan(tx.downlinkHz!);
    const last = sched.steps[sched.steps.length - 1]!;
    expect(last.downlinkHz!).toBeLessThan(tx.downlinkHz!);
    for (let i = 1; i < sched.steps.length; i++) {
      expect(sched.steps[i]!.downlinkHz!).toBe(sched.steps[i - 1]!.downlinkHz! - 5000);
    }
  });

  it('leaves the 2 m uplink alone', () => {
    expect(new Set(sched.steps.map((s) => s.uplinkHz))).toEqual(new Set([tx.uplinkHz]));
  });

  it('spans about ±10 kHz on 70 cm for a good pass', () => {
    const span = sched.steps[0]!.downlinkHz! - sched.steps[sched.steps.length - 1]!.downlinkHz!;
    expect(span).toBeGreaterThanOrEqual(15_000);
    expect(span).toBeLessThanOrEqual(25_000);
  });

  it('finds the step in force and the next one', () => {
    const mid = sched.steps[2]!.t + SECOND;
    expect(stepAt(sched, mid).current).toBe(sched.steps[2]);
    expect(stepAt(sched, mid).next).toBe(sched.steps[3]);
    expect(stepAt(sched, best.aos - HOUR).current).toBe(sched.steps[0]);
  });
});

describe('track', () => {
  it('samples every second from AOS to LOS', () => {
    expect(track[0]!.t).toBe(best.aos);
    expect(track[track.length - 1]!.t).toBe(best.los);
    expect(track.length).toBeGreaterThan(300);
  });
  it('interpolates azimuth the short way through north', () => {
    const t: TrackPoint[] = [
      { t: 0, azDeg: 350, elDeg: 10, rangeM: 1, rangeRateMps: -1 },
      { t: 1000, azDeg: 10, elDeg: 20, rangeM: 1, rangeRateMps: -1 },
    ];
    expect(sampleAt(t, 500)!.azDeg).toBeCloseTo(0);
    expect(sampleAt(t, 250)!.azDeg).toBeCloseTo(355);
    expect(sampleAt(t, 500)!.elDeg).toBeCloseTo(15);
  });
});

describe('cues (D14)', () => {
  const sched = retuneSchedule(track, tx, 5000);
  const events = passCues('SO-50', best, track, sched, formatMHz);

  it('reads frequencies digit by digit', () => {
    expect(speakableMHz('436.800')).toBe('4 3 6 point 8 0 0');
  });
  it('warns before AOS, announces AOS with where to listen, and ends at LOS', () => {
    expect(events[0]!.t).toBe(best.aos - 120 * SECOND);
    const aos = events.find((e) => e.t === best.aos)!;
    expect(aos.text).toMatch(/is up/);
    expect(aos.text).toMatch(/Listen on 4 3 6 point/);
    expect(events[events.length - 1]!.text).toMatch(/Pass over/);
    expect(events.some((e) => e.kind === 'retune')).toBe(true);
  });
  it('by default speaks rise, peak and set, and plays retunes as a tone', () => {
    const key = passCues('SO-50', best, track, sched, formatMHz, 'key');
    const retunes = key.filter((e) => e.kind === 'retune');
    expect(retunes.length).toBeGreaterThan(0);
    expect(retunes.every((e) => !e.speak)).toBe(true);
    expect(key.filter((e) => e.speak).every((e) => !/Retune/.test(e.text))).toBe(true);
    expect(key.find((e) => e.t === best.aos)!.speak).toBe(true);
    expect(key.find((e) => /Peak/.test(e.text))!.speak).toBe(true);
  });
  it('"none" speaks nothing between AOS and LOS, but still announces both', () => {
    const none = passCues('SO-50', best, track, sched, formatMHz, 'none');
    for (const e of none) expect(e.speak).toBe(e.t <= best.aos || e.t >= best.los);
    expect(none.find((e) => /Pass over/.test(e.text))!.speak).toBe(true);
  });
  it('fires what the clock crosses, and nothing on a jump', () => {
    const e = events[1]!;
    expect(dueCues(events, e.t - 500, e.t + 500)).toContain(e);
    expect(dueCues(events, e.t - HOUR, e.t + 500)).toEqual([]);
    expect(dueCues(events, e.t + 500, e.t - 500)).toEqual([]);
  });
});
