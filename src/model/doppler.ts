// D7: Doppler from range rate. ṙ in m/s, positive when the satellite is moving away.

import type { RadioStepHz, Transmitter } from './types';

const C = 299_792_458; // lint-allow-number: speed of light, m/s — not a frequency

/** The downlink you hear. Approaching (ṙ < 0) → above nominal. */
export function downlinkHeardHz(nominalHz: number, rangeRateMps: number): number {
  return Math.round(nominalHz * (1 - rangeRateMps / C));
}

/** The uplink you send so the satellite hears `nominalHz`. Approaching (ṙ < 0) → below nominal. */
export function uplinkToSendHz(nominalHz: number, rangeRateMps: number): number {
  return Math.round(nominalHz / (1 - rangeRateMps / C));
}

/** Nearest frequency the radio can actually be set to. */
export function quantise(hz: number, stepHz: RadioStepHz): number {
  return Math.round(hz / stepHz) * stepHz;
}

export interface FmTuning {
  /** What to dial in for the uplink. */
  uplinkHz: number | null;
  /** What to dial in for the downlink. */
  downlinkHz: number | null;
  /**
   * Which side the beginner hint says to retune (D7): the higher-frequency one, because its
   * Doppler is larger. Derived from the transmitter, never per satellite.
   */
  tuneSide: 'uplink' | 'downlink' | null;
}

/**
 * Settings for an FM transmitter at a moment with range rate ṙ. Following the rule of thumb, the
 * lower-frequency side stays at nominal and only the higher side is corrected and quantised.
 */
export function fmTuning(tx: Transmitter, rangeRateMps: number, stepHz: RadioStepHz): FmTuning {
  const up = tx.uplinkHz;
  const down = tx.downlinkHz;
  if (up === null && down === null) return { uplinkHz: null, downlinkHz: null, tuneSide: null };
  if (up === null || down === null || up === down) {
    // One side only, or simplex digipeater: correct what exists.
    return {
      uplinkHz: up === null ? null : quantise(uplinkToSendHz(up, rangeRateMps), stepHz),
      downlinkHz: down === null ? null : quantise(downlinkHeardHz(down, rangeRateMps), stepHz),
      tuneSide: down !== null ? 'downlink' : 'uplink',
    };
  }
  if (down > up) {
    return { uplinkHz: up, downlinkHz: quantise(downlinkHeardHz(down, rangeRateMps), stepHz), tuneSide: 'downlink' };
  }
  return { uplinkHz: quantise(uplinkToSendHz(up, rangeRateMps), stepHz), downlinkHz: down, tuneSide: 'uplink' };
}
