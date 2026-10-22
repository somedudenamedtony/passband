// SPEC-v2 D19: three answers (goal, radio, guidance) replace the experience preset and its
// overrides. Everything else is remembered from the operator's last choice. migrateStation turns a
// v1 station into this without losing an explicit choice.

import type { Hours, RadioStepHz, Station } from './types';

export interface LiveCues {
  /** Whether cues play at all during a pass. */
  on: boolean;
  speech: boolean;
  tones: boolean;
  vibration: boolean;
}

export interface StationV2 {
  callsign: string;
  units: 'imperial' | 'metric'; // D20
  goal: 'listen' | 'contacts' | 'both';
  radio: 'fm' | 'ssb' | 'sdr' | 'unknown';
  guidance: 'guided' | 'numbers';
  /** D24. Persisted as the v1 'favorites' setting so both apps share one set until R4. */
  mySatellites: number[];
  showEverythingWorkable: boolean;
  /** D26: max elevation at or above these reads as fair / great. */
  qualityThresholdsDeg: { fair: number; great: number };
  hours: Hours | null;
  remembered: {
    liveView: 'sky' | 'compass' | 'ar';
    cues: LiveCues;
    stepHz: RadioStepHz;
    speakInPass: 'key' | 'all' | 'none';
    recordPasses: boolean;
  };
  compassOffsetDeg: number; // D10
  compassCalibratedAt: number | null;
}

/** SPEC-v2 §11 Q3 proposed defaults. */
export const DEFAULT_QUALITY_DEG = { fair: 20, great: 45 } as const;

export function migrateStation(v1: Station, favorites: readonly number[]): StationV2 {
  const isNew = v1.experience === 'new';
  return {
    callsign: v1.callsign,
    units: v1.units,
    goal: v1.goal === 'explore' ? 'both' : v1.goal,
    radio: v1.equipment,
    // An explicit tips choice says more about what the operator wants than the preset did.
    guidance: (v1.showTips ?? isNew) ? 'guided' : 'numbers',
    mySatellites: [...favorites].sort((a, b) => a - b),
    showEverythingWorkable: false,
    qualityThresholdsDeg: { ...DEFAULT_QUALITY_DEG },
    hours: v1.hours,
    remembered: {
      liveView: v1.liveView ?? (isNew ? 'compass' : 'sky'),
      cues: { on: v1.liveCues ?? isNew, ...v1.cues },
      stepHz: v1.radioStepHz,
      speakInPass: v1.speakInPass,
      recordPasses: v1.recordPasses,
    },
    compassOffsetDeg: v1.compassOffsetDeg,
    compassCalibratedAt: v1.compassCalibratedAt,
  };
}
