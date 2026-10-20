// Bring an existing log in: an ADIF file from LoTW, another logger or an earlier Passband export.
// Satellite contacts only; duplicates (same call, minute and satellite) are skipped. Imported
// contacts count as already exported: they came from a logbook that has them.

import { modeFromAdif, parseAdif, parseAdifFreq, parseAdifTime } from './adif';
import { grid4, isValidGrid, normaliseGrid } from './grid';
import { newId } from './ids';
import { MINUTE } from './time';
import type { Location, QsoRecord, Satellite, Station } from './types';

export interface ImportResult {
  qsos: QsoRecord[];
  duplicates: number;
  /** Records that aren't satellite contacts (no PROP_MODE=SAT and no SAT_NAME). */
  notSatellite: number;
  /** Records missing a callsign or a usable date and time. */
  unreadable: number;
}

/** Same call, same minute, same satellite: the same contact. */
export function qsoKey(q: Pick<QsoRecord, 'call' | 'timeOn' | 'satName' | 'satDisplayName'>): string {
  return `${q.call.toUpperCase()}|${Math.floor(q.timeOn / MINUTE)}|${(q.satName ?? q.satDisplayName).toUpperCase()}`;
}

export function importAdif(
  text: string,
  sats: readonly Satellite[],
  existing: readonly QsoRecord[],
  station: Station,
  location: Location,
  importedAt: number,
): ImportResult {
  const byLotw = new Map<string, Satellite>();
  for (const s of sats) if (s.lotwName) byLotw.set(s.lotwName.toUpperCase(), s);
  const seen = new Set(existing.map(qsoKey));
  const out: ImportResult = { qsos: [], duplicates: 0, notSatellite: 0, unreadable: 0 };

  for (const r of parseAdif(text)) {
    const satName = r.SAT_NAME?.trim() || null;
    if ((r.PROP_MODE ?? '').trim().toUpperCase() !== 'SAT' && !satName) {
      out.notSatellite++;
      continue;
    }
    const call = (r.CALL ?? '').trim().toUpperCase();
    const timeOn = parseAdifTime(r.QSO_DATE, r.TIME_ON);
    if (!call || timeOn === null) {
      out.unreadable++;
      continue;
    }
    const sat = satName ? byLotw.get(satName.toUpperCase()) : undefined;
    const vucc = (r.VUCC_GRIDS ?? '').split(',').map((g) => g.trim()).filter(isValidGrid);
    const theirGrid = r.GRIDSQUARE?.trim() ?? '';
    const myGrid = r.MY_GRIDSQUARE?.trim() ?? '';
    const note = [r.COMMENT?.trim(), vucc.length > 1 ? `VUCC_GRIDS ${vucc.join(',')}` : null].filter(Boolean).join(' · ');
    const q: QsoRecord = {
      id: newId(),
      call,
      timeOn,
      satNoradId: sat?.noradId ?? 0,
      satName,
      satDisplayName: sat?.name ?? satName ?? 'Unknown satellite',
      transmitterId: '',
      freqHz: parseAdifFreq(r.FREQ) ?? 0,
      freqRxHz: parseAdifFreq(r.FREQ_RX) ?? 0,
      mode: modeFromAdif(r.MODE, r.SUBMODE),
      gridsquare: isValidGrid(theirGrid) ? normaliseGrid(theirGrid) : vucc[0] ? normaliseGrid(vucc[0]) : null,
      myGridsquare: isValidGrid(myGrid) ? normaliseGrid(myGrid) : grid4(location.grid6),
      stationCallsign: (r.STATION_CALLSIGN ?? r.OPERATOR ?? station.callsign).trim().toUpperCase(),
      locationId: location.id,
      recordingId: null,
      exportedAt: importedAt,
      note: note || null,
    };
    const key = qsoKey(q);
    if (seen.has(key)) {
      out.duplicates++;
      continue;
    }
    seen.add(key);
    out.qsos.push(q);
  }
  return out;
}
