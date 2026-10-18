// D7: the FM retune schedule — "436.805 now → 436.800 at +2:10 → 436.795 at +4:30…".

import { downlinkHeardHz, fmTuning, uplinkToSendHz } from './doppler';
import type { TrackPoint } from './track';
import type { RadioStepHz, Transmitter } from './types';

export interface RetuneStep {
  /** When to switch to this setting (UTC ms). The first step is AOS. */
  t: number;
  uplinkHz: number | null;
  downlinkHz: number | null;
}

export interface RetuneSchedule {
  tuneSide: 'uplink' | 'downlink' | null;
  steps: RetuneStep[];
}

/**
 * Walk the track and emit a step every time the quantised setting changes. Only the side the
 * beginner rule says to tune ever changes; the other stays at nominal.
 */
export function retuneSchedule(track: readonly TrackPoint[], tx: Transmitter, stepHz: RadioStepHz): RetuneSchedule {
  const steps: RetuneStep[] = [];
  let tuneSide: RetuneSchedule['tuneSide'] = null;
  for (const p of track) {
    const t = fmTuning(tx, p.rangeRateMps, stepHz);
    tuneSide = t.tuneSide;
    const prev = steps[steps.length - 1];
    if (!prev || prev.uplinkHz !== t.uplinkHz || prev.downlinkHz !== t.downlinkHz) {
      steps.push({ t: p.t, uplinkHz: t.uplinkHz, downlinkHz: t.downlinkHz });
    }
  }
  return { tuneSide, steps };
}

/** The step in force at time t (the first one before AOS). */
export function stepAt(schedule: RetuneSchedule, t: number): { current: RetuneStep | null; next: RetuneStep | null } {
  const { steps } = schedule;
  let i = 0;
  while (i + 1 < steps.length && steps[i + 1]!.t <= t) i++;
  return { current: steps[i] ?? null, next: steps[i + 1] ?? null };
}

/** Exact (unquantised) frequencies at a moment, for the experienced display. */
export function exactAt(tx: Transmitter, rangeRateMps: number): { uplinkHz: number | null; downlinkHz: number | null } {
  return {
    uplinkHz: tx.uplinkHz === null ? null : uplinkToSendHz(tx.uplinkHz, rangeRateMps),
    downlinkHz: tx.downlinkHz === null ? null : downlinkHeardHz(tx.downlinkHz, rangeRateMps),
  };
}
