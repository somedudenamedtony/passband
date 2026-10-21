import { describe, expect, it } from 'vitest';
import { DEFAULT_STATION } from '../data/station';
import { matchesOperator, operatingTransmitter, operatorPreferences } from './operator';
import type { Satellite, Transmitter } from './types';

const fm: Transmitter = { id: 'fm', description: '', kind: 'fm_repeater', mode: 'FM', status: 'active', uplinkHz: 145_850_000, downlinkHz: 436_795_000, uplinkHighHz: null, downlinkHighHz: null, inverting: null, ctcssHz: null };
const linear: Transmitter = { ...fm, id: 'ssb', kind: 'linear_transponder', mode: 'USB' };
const satellite = (transmitters: Transmitter[]): Satellite => ({ noradId: 1, name: 'Test', lotwName: null, status: 'active', elements: {} as Satellite['elements'], elementsEpoch: 0, elementsSource: 'celestrak-omm', transmitters, overlay: { curated: true, difficulty: 'beginner', receiveOnly: false, note: null } });

describe('operator preferences', () => {
  it('uses experience only for choices the operator has not made', () => {
    expect(operatorPreferences(DEFAULT_STATION)).toMatchObject({ tips: true, compact: false, cues: true, view: 'compass' });
    expect(operatorPreferences({ ...DEFAULT_STATION, experience: 'experienced', showTips: true, compactDetails: false, liveView: 'ar', liveCues: true }))
      .toEqual({ tips: true, compact: false, view: 'ar', cues: true });
    expect(operatorPreferences({ ...DEFAULT_STATION, showTips: false, compactDetails: true, liveCues: false })).toMatchObject({ tips: false, compact: true, cues: false });
  });

  it('does not recommend an SSB-only target to an FM operator or contacts to an SDR receiver', () => {
    expect(matchesOperator(satellite([linear]), { ...DEFAULT_STATION, equipment: 'fm' })).toBe(false);
    expect(matchesOperator(satellite([{ ...fm, downlinkHz: 1_267_000_000 }]), { ...DEFAULT_STATION, equipment: 'fm' })).toBe(false);
    expect(matchesOperator(satellite([fm]), { ...DEFAULT_STATION, equipment: 'sdr' })).toBe(false);
    expect(matchesOperator(satellite([fm]), { ...DEFAULT_STATION, goal: 'listen', equipment: 'sdr' })).toBe(true);
  });

  it('selects a compatible active transmitter and leaves other targets available to explore', () => {
    const sat = satellite([linear, fm]);
    expect(operatingTransmitter(sat, { ...DEFAULT_STATION, equipment: 'fm' })?.id).toBe('fm');
    expect(matchesOperator(satellite([{ ...fm, status: 'inactive' }]), DEFAULT_STATION)).toBe(false);
    expect(matchesOperator(satellite([linear]), { ...DEFAULT_STATION, goal: 'explore', equipment: 'fm' })).toBe(true);
  });
});
