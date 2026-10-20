import { describe, expect, it } from 'vitest';
import { liveness, passOutlook } from './outlook';
import { inHours, nextGoodPass } from './selection';
import { HOUR, MINUTE } from './time';
import type { Pass, Satellite, StatusReport, Transmitter } from './types';

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

const T0 = 100 * HOUR;

function report(hoursAgo: number, kind: StatusReport['kind'], mode = 'FM'): StatusReport {
  return { t: T0 - hoursAgo * HOUR, callsign: 'W7LIT', grid: null, kind, mode };
}

function sat(noradId: number, over: Partial<Satellite> = {}, latest: StatusReport[] | null = [report(2, 'heard')]): Satellite {
  return {
    noradId,
    name: `S${noradId}`,
    lotwName: null,
    status: 'active',
    elements: {} as Satellite['elements'],
    elementsEpoch: 0,
    elementsSource: 'celestrak-omm',
    transmitters: [fm],
    overlay: { curated: true, difficulty: 'beginner', note: null, receiveOnly: false, operation: null },
    reports:
      latest === null
        ? undefined
        : { source: 'amsat', fetchedAt: T0, windowHours: 96, heard: 0, notHeard: 0, lastHeard: null, latest },
    ...over,
  };
}

function pass(noradId: number, aos: number, sunlitFraction: number | null = 1): Pass {
  return {
    noradId,
    locationId: 'l',
    aos,
    tca: aos + 5 * MINUTE,
    los: aos + 10 * MINUTE,
    maxElDeg: 60,
    aosAzDeg: 0,
    losAzDeg: 180,
    visibleSecondsAboveMask: 600,
    elementsEpoch: 0,
    sunlitFraction,
  };
}

describe('liveness from AMSAT reports', () => {
  it('heard lately when heard recently and more often than not', () => {
    expect(liveness(sat(1), 'FM').state).toBe('heard');
  });
  it('quiet when mostly silent, even with one old "heard" (the AO-91 case)', () => {
    const s = sat(1, {}, [report(10, 'not_heard'), report(20, 'not_heard'), report(30, 'not_heard'), report(96, 'heard')]);
    expect(liveness(s, 'FM').state).toBe('quiet');
  });
  it('no reports is its own state, not "heard" and not "dead" (the PO-101 case)', () => {
    expect(liveness(sat(1, {}, []), 'FM').state).toBe('no-reports');
  });
  it('unknown when AMSAT does not track it (D6)', () => {
    expect(liveness(sat(1, {}, null), 'FM').state).toBe('unknown');
  });
  it('telemetry alone does not count as the repeater being heard', () => {
    const s = sat(1, {}, [report(1, 'telemetry_only'), report(2, 'not_heard')]);
    expect(liveness(s, 'FM').state).toBe('quiet');
  });
  it('counts only the mode asked for: APRS heard says nothing about FM', () => {
    const s = sat(1, {}, [report(1, 'heard', 'VHF_Digi')]);
    expect(liveness(s, 'FM').state).toBe('no-reports');
    expect(liveness(s).state).toBe('heard');
  });
  it('measures recency from the catalog build, so an old catalog offline does not go quiet', () => {
    expect(liveness(sat(1), 'FM').state).toBe('heard');
  });
});

describe('pass outlook', () => {
  it('schedule-only satellites are unlikely, with the reason', () => {
    const o = passOutlook(pass(1, T0), sat(1, { overlay: { ...sat(1).overlay, operation: 'scheduled' } }), T0);
    expect(o.level).toBe('unlikely');
    expect(o.reason).toMatch(/announced passes/);
  });
  it('a sunlight-only satellite is off in shadow, uncertain in part shadow, fine in sun', () => {
    const s = sat(1, { overlay: { ...sat(1).overlay, operation: 'sunlit' } });
    expect(passOutlook(pass(1, T0, 0), s, T0).level).toBe('unlikely');
    expect(passOutlook(pass(1, T0, 0.7), s, T0).level).toBe('uncertain');
    expect(passOutlook(pass(1, T0, 1), s, T0).level).toBe('likely');
  });
});

describe('next good pass (the card)', () => {
  it('skips an unlikely pass for a likely one later, and keeps uncertain as a fallback', () => {
    const sched = sat(1, { overlay: { ...sat(1).overlay, operation: 'scheduled' } });
    const unknown = sat(2, {}, null);
    const heard = sat(3);
    const sats = new Map([sched, unknown, heard].map((s) => [s.noradId, s]));
    const passes = [pass(1, T0 + HOUR), pass(2, T0 + 2 * HOUR), pass(3, T0 + 3 * HOUR)];
    expect(nextGoodPass(passes, sats, 'new', T0)).toEqual(passes[2]);
    expect(nextGoodPass(passes.slice(0, 2), sats, 'new', T0)).toEqual(passes[1]);
    expect(nextGoodPass(passes.slice(0, 1), sats, 'new', T0)).toBeNull();
  });
  it('prefers a pass in the user’s hours, falling back to any hour', () => {
    const s = sat(1);
    const sats = new Map([[1, s]]);
    // Two passes six hours apart can't both be in a three-hour window around the first.
    const a = pass(1, T0 + HOUR);
    const b = pass(1, T0 + 7 * HOUR);
    const d = new Date(b.aos);
    const m = d.getHours() * 60 + d.getMinutes();
    const hours = { fromMin: (m + 1440 - 60) % 1440, toMin: (m + 60) % 1440 };
    expect(nextGoodPass([a, b], sats, 'new', T0, hours)).toEqual(b);
    expect(nextGoodPass([a], sats, 'new', T0, hours)).toEqual(a);
  });
});

describe('hours', () => {
  it('handles windows that wrap past midnight', () => {
    const at = (h: number) => {
      const d = new Date(2026, 0, 1, h, 0);
      return d.getTime();
    };
    const night = { fromMin: 22 * 60, toMin: 2 * 60 };
    expect(inHours(at(23), night)).toBe(true);
    expect(inHours(at(1), night)).toBe(true);
    expect(inHours(at(12), night)).toBe(false);
    expect(inHours(at(12), null)).toBe(true);
  });
});
