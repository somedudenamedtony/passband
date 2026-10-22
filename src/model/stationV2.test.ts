import { describe, expect, it } from 'vitest';
import { DEFAULT_STATION } from '../data/station';
import { migrateStation } from './stationV2';

describe('migrateStation (SPEC-v2 D19)', () => {
  it('turns the experience preset into guidance and remembered live choices', () => {
    const fresh = migrateStation(DEFAULT_STATION, []);
    expect(fresh).toMatchObject({ guidance: 'guided', goal: 'contacts', radio: 'unknown', remembered: { liveView: 'compass', cues: { on: true, speech: true } } });
    const old = migrateStation({ ...DEFAULT_STATION, experience: 'experienced' }, []);
    expect(old).toMatchObject({ guidance: 'numbers', remembered: { liveView: 'sky', cues: { on: false } } });
  });

  it('keeps every explicit choice, false included', () => {
    const s = migrateStation(
      { ...DEFAULT_STATION, callsign: 'W7LIT', experience: 'new', showTips: false, liveView: 'ar', liveCues: false, goal: 'explore', equipment: 'ssb', units: 'metric', compassOffsetDeg: 4, radioStepHz: 2500, recordPasses: true, hours: null },
      [43017, 25544],
    );
    expect(s).toMatchObject({
      callsign: 'W7LIT', guidance: 'numbers', goal: 'both', radio: 'ssb', units: 'metric', hours: null,
      mySatellites: [25544, 43017], compassOffsetDeg: 4,
      remembered: { liveView: 'ar', cues: { on: false }, stepHz: 2500, recordPasses: true },
    });
  });
});
