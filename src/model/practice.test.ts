import { describe, expect, it } from 'vitest';
import { FixedClock, SimulatedClock } from '../clock';
import { whatYoullHear } from './listen';
import { toneMix, tuningVerdict } from './practice';
import { easiestPass } from './selection';
import { HOUR, MINUTE, SECOND } from './time';
import type { Pass, Satellite, Transmitter } from './types';

describe('practice tone (D16)', () => {
  it('is clean on frequency and noise far off, symmetric either side', () => {
    expect(toneMix(0)).toEqual({ tone: 1, noise: 0 });
    expect(toneMix(1000)).toEqual({ tone: 1, noise: 0 });
    expect(toneMix(-20_000)).toEqual({ tone: 0, noise: 1 });
    const a = toneMix(4000);
    expect(a.tone).toBeGreaterThan(0);
    expect(a.noise).toBeGreaterThan(0);
    expect(toneMix(-4000)).toEqual(a);
  });
  it('tells you when to retune', () => {
    expect(tuningVerdict(500)).toBe('on');
    expect(tuningVerdict(-3000)).toBe('close');
    expect(tuningVerdict(10_000)).toBe('off');
  });
});

describe('simulated clock (D16)', () => {
  it('starts where told and runs at the chosen rate', () => {
    const real = new FixedClock(1_000);
    const sim = new SimulatedClock(5 * HOUR, 4, real);
    expect(sim.now()).toBe(5 * HOUR);
    real.advance(10 * SECOND);
    expect(sim.now()).toBe(5 * HOUR + 40 * SECOND);
  });
});

const fm: Transmitter = {
  id: 't',
  description: '',
  kind: 'fm_repeater',
  uplinkHz: 1,
  uplinkHighHz: null,
  downlinkHz: 2,
  downlinkHighHz: null,
  inverting: null,
  mode: 'FM',
  ctcssHz: null,
  status: 'active',
};

function sat(noradId: number, difficulty: Satellite['overlay']['difficulty'], status: Satellite['status'] = 'active'): Satellite {
  return {
    noradId,
    name: `S${noradId}`,
    lotwName: null,
    status,
    elements: {} as Satellite['elements'],
    elementsEpoch: 0,
    elementsSource: 'celestrak-omm',
    transmitters: [fm],
    overlay: { curated: true, difficulty, note: null, receiveOnly: false },
  };
}

function pass(noradId: number, aos: number, maxElDeg: number): Pass {
  return {
    noradId,
    locationId: 'l',
    aos,
    tca: aos + 5 * MINUTE,
    los: aos + 10 * MINUTE,
    maxElDeg,
    aosAzDeg: 0,
    losAzDeg: 180,
    visibleSecondsAboveMask: 600,
    elementsEpoch: 0,
  };
}

describe('easiest pass (§5.5)', () => {
  const sats = new Map([1, 2, 3, 4].map((n) => [n, sat(n, n === 3 ? 'advanced' : 'beginner', n === 4 ? 'inactive' : 'active')]));
  it('picks the highest beginner FM pass in the next 12 hours', () => {
    const passes = [pass(1, 1 * HOUR, 40), pass(2, 3 * HOUR, 70), pass(3, 2 * HOUR, 85), pass(4, 2 * HOUR, 88), pass(1, 14 * HOUR, 89)];
    expect(easiestPass(passes, sats, 0)).toEqual(passes[1]);
  });
  it('falls back to the next 24 hours, and skips passes already started', () => {
    const passes = [pass(1, -1 * MINUTE, 80), pass(2, 15 * HOUR, 50)];
    expect(easiestPass(passes, sats, 0)).toEqual(passes[1]);
  });
  it('returns null when nothing qualifies', () => {
    expect(easiestPass([pass(1, HOUR, 10)], sats, 0)).toBeNull();
  });
});

describe('listen tonight', () => {
  it('describes what you will hear from the transmitter, not the satellite name', () => {
    expect(whatYoullHear(fm)).toMatch(/callsigns/);
    expect(whatYoullHear({ ...fm, kind: 'digipeater', mode: 'APRS' })).toMatch(/position reports/);
    expect(whatYoullHear({ ...fm, kind: 'beacon', mode: 'CW', uplinkHz: null })).toMatch(/Morse/);
  });
});

describe('horizon mask affects ranking (D9)', () => {
  const sats = new Map([[1, sat(1, 'beginner')]]);
  it('a high pass mostly hidden behind trees is not a good pass, and the next one is chosen', async () => {
    const { isGoodPass, nextGoodPass } = await import('./selection');
    const hidden = { ...pass(1, HOUR, 47), visibleSecondsAboveMask: 90 };
    const open = pass(1, 3 * HOUR, 30);
    expect(isGoodPass(hidden, 'new')).toBe(false);
    expect(nextGoodPass([hidden, open], sats, 'new', 0)).toEqual(open);
  });
});
