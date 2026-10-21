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
    /**
     * When the satellite's transponder is on, from the overlay (D6). null = we don't know.
     * Absent in catalogs built before this field; read it as null.
     */
    operation?: Operation | null;
    /** The curated story: who built it, how it got up there, what's notable (D6, cited). */
    profile?: SatelliteProfile | null;
  };
  /** Background from SatNOGS DB (D4). Absent in catalogs built before this field. */
  about?: SatelliteAbout;
  /**
   * Recent "heard / not heard" reports from the AMSAT status page, collected by the daily build
   * (D4). Absent when AMSAT doesn't track this satellite (or the catalog predates this field).
   */
  reports?: StatusReports;
}

/**
 * continuous: on whenever it is up. scheduled: switched on for announced passes only.
 * sunlit: battery too weak to run in the Earth's shadow.
 */
export type Operation = 'continuous' | 'scheduled' | 'sunlit';

export type StatusReportKind = 'heard' | 'not_heard' | 'telemetry_only' | 'crew_active' | 'other';

export interface StatusReport {
  /** UTC epoch ms; AMSAT records reports to the half hour. */
  t: number;
  callsign: string;
  grid: string | null;
  kind: StatusReportKind;
  /** AMSAT's mode label for the transponder: "FM", "V/u", "VHF_Digi"… */
  mode: string;
}

export interface StatusReports {
  source: 'amsat';
  fetchedAt: number;
  /** How far back the build asked for. */
  windowHours: number;
  /** null when the build couldn't reach AMSAT: unknown, not "nobody heard it" (D6). */
  heard: number | null;
  notHeard: number | null;
  lastHeard: number | null;
  /** Newest first, capped. */
  latest: StatusReport[] | null;
  /**
   * Reports per UTC day, oldest first, over a longer window than the counts above: the activity
   * graph. Absent in older catalogs; null when the build couldn't reach AMSAT.
   */
  daily?: Array<{ day: number; heard: number; notHeard: number }> | null;
}

export interface SatelliteAbout {
  /** UTC epoch ms of launch; null when SatNOGS doesn't know. */
  launched: number | null;
  /** ISO 3166 alpha-2 codes, as SatNOGS lists them. */
  countries: string[];
  /** Other names it goes by: OSCAR number, callsigns, the builder's name. */
  alsoKnownAs: string[];
  website: string | null;
  /** A photo published with the app (relative to its base), or null. */
  image: string | null;
}

export interface SatelliteProfile {
  /** Who built and runs it, in a few words. */
  builtBy: string;
  /** "Delta II from Vandenberg" — how it got up there. */
  launch: string | null;
  /** Two or three sentences: what it is and what's worth knowing. */
  story: string;
  source: string;
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

/**
 * When the user can get out, as local minutes after midnight. A preference about the wall clock,
 * not a stored time (rule 4 is about timestamps). from > to wraps past midnight.
 */
export interface Hours {
  fromMin: number;
  toMin: number;
}

export interface Station {
  callsign: string;
  units: 'imperial' | 'metric';
  experience: 'new' | 'experienced';
  radioStepHz: RadioStepHz;
  cues: { speech: boolean; tones: boolean; vibration: boolean };
  compassOffsetDeg: number;
  /** D13: start recording automatically at AOS. */
  recordPasses: boolean;
  /** When sun calibration last set the offset (D10); null = never. */
  compassCalibratedAt: number | null;
  /** What speech reads between AOS and LOS (D14): rise/peak/set only, everything, or nothing. */
  speakInPass: 'key' | 'all' | 'none';
  /** The top pick prefers passes in these hours; null = any time. */
  hours: Hours | null;
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
  /** Share of the pass (0–1) with the satellite in sunlight; null if it couldn't be worked out. */
  sunlitFraction: number | null;
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

/** D13: a pass recording. Blobs stay on the device (§7). */
export interface Recording {
  id: string;
  noradId: number;
  satDisplayName: string;
  /** Where it was recorded and which transmitter, so a contact logged from playback is complete. */
  locationId: string;
  transmitterId: string | null;
  startedAt: number;
  durationMs: number;
  /** iOS stops recording when the app is backgrounded or the screen locks. */
  interrupted: boolean;
  mimeType: string;
  blob: Blob;
}
