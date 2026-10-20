// §8.1, first step: tuning a linear (SSB/CW) transponder with "one true frequency". Pick a spot in
// the downlink passband as the satellite sees it; the matching uplink spot follows from the
// passband's mapping, and Doppler (D7) turns both into what you send and what you hear. Keeping
// the spot fixed at the satellite is what keeps you on the same QSO all pass.

import { downlinkHeardHz, uplinkToSendHz } from './doppler';
import type { Transmitter } from './types';

/** SSB dials step in 10 Hz; finer is noise on a phone screen. */
export const LINEAR_STEP_HZ = 10;

export interface Passband {
  upLowHz: number;
  upHighHz: number;
  downLowHz: number;
  downHighHz: number;
  inverting: boolean;
}

/** The passband edges, or null when the catalog doesn't give both ranges (Unknown, D6). */
export function passband(tx: Transmitter): Passband | null {
  if (tx.kind !== 'linear_transponder') return null;
  const { uplinkHz, uplinkHighHz, downlinkHz, downlinkHighHz, inverting } = tx;
  if (uplinkHz === null || uplinkHighHz === null || downlinkHz === null || downlinkHighHz === null || inverting === null) return null;
  if (uplinkHighHz <= uplinkHz || downlinkHighHz <= downlinkHz) return null;
  return { upLowHz: uplinkHz, upHighHz: uplinkHighHz, downLowHz: downlinkHz, downHighHz: downlinkHighHz, inverting };
}

export function passbandCentre(pb: Passband): number {
  return Math.round((pb.downLowHz + pb.downHighHz) / 2 / LINEAR_STEP_HZ) * LINEAR_STEP_HZ;
}

export function clampToPassband(pb: Passband, downAtSatHz: number): number {
  return Math.min(pb.downHighHz, Math.max(pb.downLowHz, downAtSatHz));
}

/** The uplink spot (at the satellite) that comes out at this downlink spot. */
export function uplinkForDownlink(pb: Passband, downAtSatHz: number): number {
  const offset = clampToPassband(pb, downAtSatHz) - pb.downLowHz;
  return pb.inverting ? pb.upHighHz - offset : pb.upLowHz + offset;
}

export interface LinearTuning {
  /** Where you are in the passband, at the satellite. */
  downAtSatHz: number;
  upAtSatHz: number;
  /** What to set on the radio: transmit and receive, Doppler-corrected, to the 10 Hz step. */
  sendHz: number;
  hearHz: number;
  /** Sideband to transmit so the downlink comes out USB (inverting flips it). */
  sendSideband: 'LSB' | 'USB';
}

export function linearTuning(pb: Passband, downAtSatHz: number, rangeRateMps: number): LinearTuning {
  const down = clampToPassband(pb, downAtSatHz);
  const up = uplinkForDownlink(pb, down);
  const step = (hz: number) => Math.round(hz / LINEAR_STEP_HZ) * LINEAR_STEP_HZ;
  return {
    downAtSatHz: down,
    upAtSatHz: up,
    sendHz: step(uplinkToSendHz(up, rangeRateMps)),
    hearHz: step(downlinkHeardHz(down, rangeRateMps)),
    sendSideband: pb.inverting ? 'LSB' : 'USB',
  };
}
