import { describe, expect, it } from 'vitest';
import { downlinkHeardHz, fmTuning, quantise, uplinkToSendHz } from './doppler';
import type { Transmitter } from './types';

// Test values only: this is a fixture, not a frequency the app ships (D6).
const DOWN = 436_795_000;
const UP = 145_850_000;
const APPROACHING = -6500; // m/s, range shrinking
const RECEDING = 6500;

const fm: Transmitter = {
  id: 't',
  description: 'test',
  kind: 'fm_repeater',
  uplinkHz: UP,
  uplinkHighHz: null,
  downlinkHz: DOWN,
  downlinkHighHz: null,
  inverting: null,
  mode: 'FM',
  ctcssHz: 67,
  status: 'active',
};

describe('Doppler sign (§10)', () => {
  it('approaching: you hear the downlink HIGH', () => {
    expect(downlinkHeardHz(DOWN, APPROACHING)).toBeGreaterThan(DOWN);
  });
  it('approaching: you transmit the uplink LOW', () => {
    expect(uplinkToSendHz(UP, APPROACHING)).toBeLessThan(UP);
  });
  it('receding: the opposite', () => {
    expect(downlinkHeardHz(DOWN, RECEDING)).toBeLessThan(DOWN);
    expect(uplinkToSendHz(UP, RECEDING)).toBeGreaterThan(UP);
  });
  it('has the right magnitude: about ±10 kHz on 70 cm for LEO', () => {
    const shift = downlinkHeardHz(DOWN, APPROACHING) - DOWN;
    expect(shift).toBeGreaterThan(9000);
    expect(shift).toBeLessThan(10_500);
  });
  it('returns integer Hz (D7)', () => {
    expect(Number.isInteger(downlinkHeardHz(DOWN, 1234.567))).toBe(true);
    expect(Number.isInteger(uplinkToSendHz(UP, 1234.567))).toBe(true);
  });
});

describe('fmTuning', () => {
  it('V/U: leaves the 2 m uplink alone and tunes the 70 cm downlink', () => {
    const t = fmTuning(fm, APPROACHING, 5000);
    expect(t.tuneSide).toBe('downlink');
    expect(t.uplinkHz).toBe(UP);
    expect(t.downlinkHz).toBe(DOWN + 10_000);
  });
  it('U/V: tunes the 70 cm uplink, low when approaching', () => {
    const uv = { ...fm, uplinkHz: DOWN, downlinkHz: UP };
    const t = fmTuning(uv, APPROACHING, 5000);
    expect(t.tuneSide).toBe('uplink');
    expect(t.downlinkHz).toBe(UP);
    expect(t.uplinkHz!).toBeLessThan(DOWN);
  });
  it('quantises to the radio step', () => {
    expect(quantise(436_801_200, 5000)).toBe(436_800_000);
    expect(quantise(436_801_300, 2500)).toBe(436_802_500);
  });
});
