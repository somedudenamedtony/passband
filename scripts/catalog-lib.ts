// D4: turn CelesTrak OMM + SatNOGS transmitters + our overlay into catalog.json.
// Pure functions only; build-catalog.ts does the fetching and writing.

import type { Catalog, ElementsSource, OmmElements, Satellite, Status, Transmitter, TransmitterKind } from '../src/model/types.ts';

// ---- Inputs ----

export interface SatnogsTransmitter {
  uuid: string;
  description: string;
  alive: boolean;
  type: 'Transmitter' | 'Transceiver' | 'Transponder' | string;
  uplink_low: number | null;
  uplink_high: number | null;
  downlink_low: number | null;
  downlink_high: number | null;
  mode: string | null;
  invert: boolean;
  norad_cat_id: number | null;
  status: 'active' | 'inactive' | 'invalid' | string;
}

export interface SatnogsSatellite {
  norad_cat_id: number | null;
  name: string;
  names: string;
  status: 'in orbit' | 're-entered' | 'future' | string;
}

/** One file per satellite in data/overlay/ (D6). */
export interface OverlayEntry {
  noradId: number;
  name?: string;
  /** D12: required for every satellite with a working uplink. null = not on LoTW's list. */
  lotwName: string | null;
  lotwNameSource?: string;
  difficulty: 'beginner' | 'intermediate' | 'advanced' | null;
  note: string | null;
  noteSource?: string;
  receiveOnly: boolean;
  /** D6: overrides of SatNOGS fields, each with the source that justifies it. */
  transmitterOverrides?: Array<{
    id: string;
    source: string;
    set: Partial<Pick<Transmitter, 'ctcssHz' | 'status' | 'kind' | 'mode'>>;
  }>;
}

// ---- Scope (D4): any uplink or downlink in 2 m or 70 cm ----

const MHZ = 1_000_000;
const BANDS: Array<[number, number]> = [
  [144 * MHZ, 148 * MHZ],
  [420 * MHZ, 450 * MHZ],
];

export function inScopeFrequency(hz: number | null): boolean {
  return hz !== null && BANDS.some(([lo, hi]) => hz >= lo && hz <= hi);
}

export function inScopeTransmitter(t: SatnogsTransmitter): boolean {
  return [t.uplink_low, t.uplink_high, t.downlink_low, t.downlink_high].some(inScopeFrequency);
}

// ---- Field mapping ----

export function mapStatus(s: string): Status {
  if (s === 'active') return 'active';
  if (s === 'inactive' || s === 'invalid') return 'inactive';
  return 'unknown';
}

/**
 * CTCSS from the SatNOGS description, which is the only place SatNOGS records it.
 * D6: an FM uplink with no tone mentioned is 'unknown', not "none".
 */
export function parseCtcss(t: SatnogsTransmitter): number | null | 'unknown' {
  const isFmUplink = t.uplink_low !== null && /^(FM|FMN)$/i.test(t.mode ?? '');
  const d = t.description;
  if (/\bno (ctcss|pl|tone)\b/i.test(d)) return null;
  const m =
    /\b(?:CTCSS|PL|tone)\s*:?\s*(\d{2,3}(?:\.\d)?)\s*(?:Hz)?/i.exec(d) ??
    /\b(\d{2,3}\.\d)\s*(?:Hz)?\s*(?:CTCSS|PL)\b/i.exec(d);
  if (m?.[1]) {
    const hz = Number(m[1]);
    if (hz >= 60 && hz <= 260) return hz;
  }
  return isFmUplink ? 'unknown' : null;
}

export function mapKind(t: SatnogsTransmitter): TransmitterKind {
  const mode = (t.mode ?? '').toUpperCase();
  const d = t.description.toUpperCase();
  if (t.uplink_low === null) return 'beacon';
  if (t.type === 'Transponder' && /^(USB|LSB|CW|SSB)$/.test(mode)) return 'linear_transponder';
  if (/APRS|DIGIPEATER|DIGI\b/.test(d)) return 'digipeater';
  if (/^(FM|FMN)$/.test(mode) && t.downlink_low !== null && t.uplink_low !== t.downlink_low) return 'fm_repeater';
  if (t.uplink_low !== null && t.uplink_low === t.downlink_low) return 'digipeater';
  return 'other';
}

export function mapMode(t: SatnogsTransmitter): string {
  const d = t.description.toUpperCase();
  if (/\bAPRS\b/.test(d)) return 'APRS';
  if (/\bSSTV\b/.test(d)) return 'SSTV';
  const m = (t.mode ?? '').toUpperCase();
  if (m === 'FMN') return 'FM';
  return m || 'Unknown';
}

function int(hz: number | null): number | null {
  return hz === null ? null : Math.round(hz);
}

export function mapTransmitter(t: SatnogsTransmitter): Transmitter {
  const kind = mapKind(t);
  return {
    id: t.uuid,
    description: t.description,
    kind,
    uplinkHz: int(t.uplink_low),
    uplinkHighHz: int(t.uplink_high),
    downlinkHz: int(t.downlink_low),
    downlinkHighHz: int(t.downlink_high),
    inverting: kind === 'linear_transponder' ? t.invert : null,
    mode: mapMode(t),
    ctcssHz: parseCtcss(t),
    status: mapStatus(t.status),
  };
}

/** D6: a satellite is only Active if some in-scope transmitter is. Never a guess. */
export function satelliteStatus(txs: Transmitter[]): Status {
  if (txs.some((t) => t.status === 'active')) return 'active';
  if (txs.length > 0 && txs.every((t) => t.status === 'inactive')) return 'inactive';
  return 'unknown';
}

/** Prefer an OSCAR-style designator ("SO-50") from SatNOGS's alternate names. */
export function displayName(s: SatnogsSatellite): string {
  const designator = s.names
    .split(/[,;]/)
    .map((n) => n.trim())
    .find((n) => /^[A-Z]{1,3}-\d{1,3}$/.test(n));
  return designator ?? s.name;
}

export function ommEpochMs(omm: OmmElements): number {
  const e = omm.EPOCH;
  return Date.parse(/[zZ]|[+-]\d\d:?\d\d$/.test(e) ? e : `${e}Z`);
}

// ---- TLE → OMM, for satellites CelesTrak does not carry ----

/** Parse a TLE into the OMM fields satellite.js needs. CelesTrak OMM is preferred (D4). */
export function tleToOmm(name: string, line1: string, line2: string): OmmElements {
  const yy = Number(line1.slice(18, 20));
  const dayOfYear = Number(line1.slice(20, 32));
  const year = yy < 57 ? 2000 + yy : 1900 + yy;
  const epochMs = Date.UTC(year, 0, 1) + (dayOfYear - 1) * 86_400_000;
  const expo = (s: string) => {
    const t = s.trim();
    if (!t) return 0;
    const m = /^([+-]?)(\d+)([+-]\d)$/.exec(t);
    if (!m) return Number(t);
    return Number(`${m[1]}0.${m[2]}e${m[3]}`);
  };
  return {
    OBJECT_NAME: name.replace(/^0 /, '').trim(),
    OBJECT_ID: line1.slice(9, 17).trim(),
    EPOCH: new Date(epochMs).toISOString().replace('Z', ''),
    MEAN_MOTION: Number(line2.slice(52, 63)),
    ECCENTRICITY: Number(`0.${line2.slice(26, 33).trim()}`),
    INCLINATION: Number(line2.slice(8, 16)),
    RA_OF_ASC_NODE: Number(line2.slice(17, 25)),
    ARG_OF_PERICENTER: Number(line2.slice(34, 42)),
    MEAN_ANOMALY: Number(line2.slice(43, 51)),
    EPHEMERIS_TYPE: 0,
    CLASSIFICATION_TYPE: line1[7] === 'C' ? 'C' : 'U',
    NORAD_CAT_ID: Number(line1.slice(2, 7)),
    ELEMENT_SET_NO: Number(line1.slice(64, 68)),
    REV_AT_EPOCH: Number(line2.slice(63, 68)),
    BSTAR: expo(line1.slice(53, 61)),
    MEAN_MOTION_DOT: Number(line1.slice(33, 43)),
    MEAN_MOTION_DDOT: expo(line1.slice(44, 52)),
  };
}

// ---- Merge ----

export interface BuildInputs {
  generatedAt: number;
  /** CelesTrak OMM (D4). Preferred whenever present. */
  elements: OmmElements[];
  /** SatNOGS TLEs converted to OMM, for satellites CelesTrak does not carry. */
  fallbackElements: OmmElements[];
  satnogsSatellites: SatnogsSatellite[];
  satnogsTransmitters: SatnogsTransmitter[];
  overlay: OverlayEntry[];
}

export interface BuildReport {
  inScope: number;
  published: number;
  missingElements: Array<{ noradId: number; name: string }>;
  fromFallback: string[];
  uncuratedWithUplink: string[];
  overlayWithoutSatellite: number[];
}

export function buildCatalog(inp: BuildInputs): { catalog: Catalog; report: BuildReport } {
  const elementsById = new Map<number, { omm: OmmElements; source: ElementsSource }>();
  for (const e of inp.fallbackElements) elementsById.set(Number(e.NORAD_CAT_ID), { omm: e, source: 'satnogs-tle' });
  for (const e of inp.elements) elementsById.set(Number(e.NORAD_CAT_ID), { omm: e, source: 'celestrak-omm' });
  const overlayById = new Map(inp.overlay.map((o) => [o.noradId, o]));
  const satById = new Map<number, SatnogsSatellite>();
  for (const s of inp.satnogsSatellites) {
    if (s.norad_cat_id !== null && s.status === 'in orbit') satById.set(s.norad_cat_id, s);
  }

  const txBySat = new Map<number, SatnogsTransmitter[]>();
  for (const t of inp.satnogsTransmitters) {
    if (t.norad_cat_id === null || !inScopeTransmitter(t)) continue;
    const list = txBySat.get(t.norad_cat_id) ?? [];
    list.push(t);
    txBySat.set(t.norad_cat_id, list);
  }

  const report: BuildReport = {
    inScope: 0,
    published: 0,
    missingElements: [],
    fromFallback: [],
    uncuratedWithUplink: [],
    overlayWithoutSatellite: [],
  };
  const satellites: Satellite[] = [];

  for (const [noradId, rawTxs] of txBySat) {
    const s = satById.get(noradId);
    if (!s) continue;
    report.inScope++;
    const ov = overlayById.get(noradId);
    const transmitters = rawTxs.map(mapTransmitter).sort((a, b) => a.id.localeCompare(b.id));
    for (const o of ov?.transmitterOverrides ?? []) {
      const tx = transmitters.find((t) => t.id === o.id);
      if (tx) Object.assign(tx, o.set);
    }
    const name = ov?.name ?? displayName(s);
    const el = elementsById.get(noradId);
    if (!el) {
      report.missingElements.push({ noradId, name });
      continue;
    }
    if (el.source !== 'celestrak-omm') report.fromFallback.push(name);
    if (!ov && transmitters.some((t) => t.uplinkHz !== null && t.status === 'active')) {
      report.uncuratedWithUplink.push(name);
    }
    satellites.push({
      noradId,
      name,
      lotwName: ov?.lotwName ?? null,
      status: satelliteStatus(transmitters),
      elements: el.omm,
      elementsEpoch: ommEpochMs(el.omm),
      elementsSource: el.source,
      transmitters,
      overlay: {
        curated: ov !== undefined,
        difficulty: ov?.difficulty ?? null,
        note: ov?.note ?? null,
        receiveOnly: ov?.receiveOnly ?? false,
      },
    });
  }

  for (const o of inp.overlay) {
    if (!satellites.some((s) => s.noradId === o.noradId)) report.overlayWithoutSatellite.push(o.noradId);
  }

  satellites.sort((a, b) => a.name.localeCompare(b.name));
  report.published = satellites.length;
  return {
    catalog: { generatedAt: inp.generatedAt, satellites },
    report,
  };
}
