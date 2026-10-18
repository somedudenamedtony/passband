// D12: LoTW-ready ADIF 3.1. Times are UTC; frequencies leave the model here as MHz text.

import { adifBand } from './bands';
import type { QsoRecord } from './types';

export const ADIF_VERSION = '3.1.4';

/** Our stored mode → ADIF MODE and SUBMODE. */
export function adifMode(mode: string): { mode: string; submode: string | null } {
  const m = mode.toUpperCase();
  if (m === 'USB' || m === 'LSB') return { mode: 'SSB', submode: m };
  if (m === 'APRS' || m === 'AFSK' || m === 'PKT' || m === 'PACKET') return { mode: 'PKT', submode: null };
  return { mode: m, submode: null };
}

/** 436795000 → "436.795". ADIF wants MHz; never a float on the way there. */
export function adifFreq(hz: number): string {
  const whole = Math.trunc(hz / 1e6);
  const frac = String(hz % 1e6).padStart(6, '0').replace(/0+$/, '');
  return frac ? `${whole}.${frac}` : String(whole);
}

function pad(n: number, w = 2): string {
  return String(n).padStart(w, '0');
}

export function adifDate(t: number): string {
  const d = new Date(t);
  return `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}`;
}

export function adifTime(t: number): string {
  const d = new Date(t);
  return `${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}`;
}

/** ADI is ASCII; lengths count characters. Anything else becomes '?'. */
function ascii(s: string): string {
  return s.replace(/[^\x20-\x7e]/g, '?');
}

function field(name: string, value: string | null | undefined): string {
  if (value === null || value === undefined || value === '') return '';
  const v = ascii(value);
  return `<${name}:${v.length}>${v} `;
}

export function qsoToAdif(q: QsoRecord): string {
  const { mode, submode } = adifMode(q.mode);
  return (
    [
      field('CALL', q.call.toUpperCase()),
      field('QSO_DATE', adifDate(q.timeOn)),
      field('TIME_ON', adifTime(q.timeOn)),
      field('BAND', adifBand(q.freqHz)),
      field('FREQ', adifFreq(q.freqHz)),
      field('BAND_RX', adifBand(q.freqRxHz)),
      field('FREQ_RX', adifFreq(q.freqRxHz)),
      field('MODE', mode),
      field('SUBMODE', submode),
      field('PROP_MODE', 'SAT'),
      field('SAT_NAME', q.satName),
      field('GRIDSQUARE', q.gridsquare),
      field('MY_GRIDSQUARE', q.myGridsquare),
      field('STATION_CALLSIGN', q.stationCallsign.toUpperCase()),
      field('COMMENT', q.note),
    ].join('') + '<EOR>'
  );
}

export function toAdif(qsos: readonly QsoRecord[], createdAt: number): string {
  const header =
    `Passband ADIF export\n` +
    field('ADIF_VER', ADIF_VERSION) +
    field('PROGRAMID', 'Passband') +
    field('CREATED_TIMESTAMP', `${adifDate(createdAt)} ${adifTime(createdAt)}`) +
    '<EOH>\n';
  return header + qsos.map(qsoToAdif).join('\n') + '\n';
}

/** Minimal ADI reader: enough to round-trip our own output in tests and import later. */
export function parseAdif(text: string): Array<Record<string, string>> {
  const start = text.search(/<EOH>/i);
  const body = start >= 0 ? text.slice(start + 5) : text;
  const records: Array<Record<string, string>> = [];
  let cur: Record<string, string> = {};
  const re = /<(\w+)(?::(\d+)(?::\w)?)?>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(body))) {
    const name = m[1]!.toUpperCase();
    if (name === 'EOR') {
      records.push(cur);
      cur = {};
      continue;
    }
    const len = Number(m[2] ?? 0);
    cur[name] = body.substr(re.lastIndex, len);
    re.lastIndex += len;
  }
  return records;
}

/** Problems that would stop LoTW accepting this as a satellite QSO. Empty = fine. */
export function lotwProblems(q: QsoRecord): string[] {
  const p: string[] = [];
  if (!q.satName) p.push('No LoTW satellite name');
  if (!adifBand(q.freqHz) || !adifBand(q.freqRxHz)) p.push('Frequency outside an amateur band');
  if (!q.stationCallsign) p.push('Your callsign is missing');
  return p;
}
