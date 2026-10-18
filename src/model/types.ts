// SPEC.md §4. All times are UTC epoch milliseconds; all frequencies are integer Hz (D7).
// Distances are metres, speeds m/s (D20).

import type { OMMJsonObject } from 'satellite.js';

export type OmmElements = OMMJsonObject;

export type ElementsSource = 'celestrak-omm' | 'satnogs-tle';

export type Status = 'active' | 'inactive' | 'unknown';

// ---- From the published catalog (D4) — read-only on device ----

export interface Catalog {
  generatedAt: number;
  satellites: Satellite[];
}

export interface Satellite {
  noradId: number;
  name: string;
  /** D12; null = cannot be logged for LoTW. Only meaningful when `overlay.curated`. */
  lotwName: string | null;
  status: Status;
  elements: OmmElements;
  elementsEpoch: number;
  /** D4: CelesTrak OMM first; SatNOGS TLE only for satellites CelesTrak does not carry. */
  elementsSource: ElementsSource;
  transmitters: Transmitter[];
  overlay: {
    /** False when nobody has curated this satellite yet; overlay fields then read as Unknown (D4). */
    curated: boolean;
    difficulty: 'beginner' | 'intermediate' | 'advanced' | null;
    note: string | null;
    receiveOnly: boolean;
  };
}

export type TransmitterKind = 'fm_repeater' | 'linear_transponder' | 'beacon' | 'digipeater' | 'other';

export interface Transmitter {
  id: string;
  description: string;
  kind: TransmitterKind;
  uplinkHz: number | null;
  uplinkHighHz: number | null;
  downlinkHz: number | null;
  downlinkHighHz: number | null;
  inverting: boolean | null;
  mode: string;
  /** D6: null = none needed; 'unknown' = we don't know. */
  ctcssHz: number | null | 'unknown';
  status: Status;
}

// ---- On-device, user-owned (IndexedDB) ----

export type RadioStepHz = 2500 | 5000 | 6250;

export interface Station {
  callsign: string;
  units: 'imperial' | 'metric';
  experience: 'new' | 'experienced';
  radioStepHz: RadioStepHz;
  cues: { speech: boolean; tones: boolean; vibration: boolean };
  compassOffsetDeg: number;
}

export interface Location {
  id: string;
  name: string;
  latDeg: number;
  lonDeg: number;
  altM: number;
  grid6: string;
  /** 36 values, index i = azimuth i*10° (D9). */
  horizonMask: number[];
}

export interface Pass {
  noradId: number;
  locationId: string;
  aos: number;
  tca: number;
  los: number;
  maxElDeg: number;
  aosAzDeg: number;
  losAzDeg: number;
  visibleSecondsAboveMask: number;
  elementsEpoch: number;
}

/** Maps 1:1 onto ADIF (D12). */
export interface QsoRecord {
  id: string;
  /** Their callsign. */
  call: string;
  timeOn: number;
  satNoradId: number;
  /** LoTW SAT_NAME at time of logging; null when the satellite has none we know of (D12). */
  satName: string | null;
  /** Display name, for the log list. */
  satDisplayName: string;
  transmitterId: string;
  /** What you transmitted on (ADIF FREQ). */
  freqHz: number;
  /** What you received on (ADIF FREQ_RX). */
  freqRxHz: number;
  /** 'FM' | 'USB' | 'LSB' | 'CW' | 'PKT' | 'SSTV' …; mapped to ADIF MODE/SUBMODE on export. */
  mode: string;
  gridsquare: string | null;
  myGridsquare: string;
  /** Your callsign when you logged it (ADIF STATION_CALLSIGN). */
  stationCallsign: string;
  locationId: string;
  recordingId: string | null;
  exportedAt: number | null;
  note: string | null;
}
