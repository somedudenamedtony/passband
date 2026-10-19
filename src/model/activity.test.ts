import { describe, expect, it } from 'vitest';
import { activities, matchesActivities } from './activity';
import type { Satellite, Transmitter } from './types';

// Fixture transmitters: no frequencies matter here, only kind, mode, uplink presence and status.
function tx(kind: Transmitter['kind'], mode: string, opts: { uplink?: boolean; status?: Transmitter['status'] } = {}): Transmitter {
  return {
    id: `${kind}-${mode}`,
    description: '',
    kind,
    uplinkHz: opts.uplink ? 1 : null,
    uplinkHighHz: null,
    downlinkHz: 1,
    downlinkHighHz: null,
    inverting: null,
    mode,
    ctcssHz: null,
    status: opts.status ?? 'active',
  };
}

function sat(...transmitters: Transmitter[]): Satellite {
  return {
    noradId: 1,
    name: 'S1',
    lotwName: null,
    status: 'active',
    elements: {} as Satellite['elements'],
    elementsEpoch: 0,
    elementsSource: 'celestrak-omm',
    transmitters,
    overlay: { curated: false, difficulty: null, note: null, receiveOnly: false },
  };
}

describe('activities', () => {
  it('reads a space station as voice, packet and images', () => {
    const iss = sat(tx('fm_repeater', 'FM', { uplink: true }), tx('digipeater', 'AFSK', { uplink: true }), tx('beacon', 'SSTV'));
    expect(activities(iss)).toEqual(new Set(['voice', 'packet', 'images']));
  });

  it('does not count the beacon most satellites also carry', () => {
    expect(activities(sat(tx('fm_repeater', 'FM', { uplink: true }), tx('beacon', 'CW')))).toEqual(new Set(['voice']));
  });

  it('calls a cubesat with only beacons telemetry', () => {
    expect(activities(sat(tx('beacon', 'CW'), tx('beacon', 'GMSK')))).toEqual(new Set(['telemetry']));
  });

  it('files linear transponders under SSB/CW and APRS under packet', () => {
    expect(activities(sat(tx('linear_transponder', 'USB', { uplink: true })))).toEqual(new Set(['ssb']));
    expect(activities(sat(tx('other', 'APRS', { uplink: true })))).toEqual(new Set(['packet']));
  });

  it('ignores transmitters reported dead', () => {
    const s = sat(tx('fm_repeater', 'FM', { uplink: true, status: 'inactive' }), tx('beacon', 'CW'));
    expect(activities(s)).toEqual(new Set(['telemetry']));
  });
});

describe('matchesActivities', () => {
  const fm = sat(tx('fm_repeater', 'FM', { uplink: true }));
  it('treats no choice as no filter', () => {
    expect(matchesActivities(fm, new Set())).toBe(true);
  });
  it('matches on any chosen activity', () => {
    expect(matchesActivities(fm, new Set(['voice', 'ssb']))).toBe(true);
    expect(matchesActivities(fm, new Set(['telemetry']))).toBe(false);
  });
});
