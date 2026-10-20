import { describe, expect, it } from 'vitest';
import { parseAdifFreq, parseAdifTime, toAdif } from './adif';
import { importAdif } from './adifImport';
import type { Location, QsoRecord, Satellite, Station } from './types';

const so50 = {
  noradId: 27607,
  name: 'SO-50',
  lotwName: 'SO-50',
} as Satellite;

const station = { callsign: 'W7LIT' } as Station;
const location = { id: 'home', grid6: 'CN87uo' } as Location;
const T = Date.UTC(2026, 9, 18, 14, 5, 9);

const rec = (fields: Record<string, string>) =>
  Object.entries(fields)
    .map(([k, v]) => `<${k}:${v.length}>${v}`)
    .join(' ') + ' <EOR>\n';

describe('ADIF field parsing', () => {
  it('reads MHz text as integer Hz without float error (D7)', () => {
    expect(parseAdifFreq('436.795')).toBe(436_795_000); // lint-allow-number: test value
    expect(parseAdifFreq('145.8125')).toBe(145_812_500); // lint-allow-number: test value
    expect(parseAdifFreq('145')).toBe(145_000_000); // lint-allow-number: test value
    expect(parseAdifFreq('abc')).toBeNull();
  });
  it('reads 4- and 6-digit TIME_ON as UTC', () => {
    expect(parseAdifTime('20261018', '140509')).toBe(T);
    expect(parseAdifTime('20261018', '1405')).toBe(Date.UTC(2026, 9, 18, 14, 5));
    expect(parseAdifTime('2026-10-18', '1405')).toBeNull();
  });
});

describe('ADIF import', () => {
  it('imports satellite contacts, matches the satellite by LoTW name, marks them exported', () => {
    const text =
      '<EOH>\n' +
      rec({ CALL: 'k1abc', QSO_DATE: '20261018', TIME_ON: '140509', PROP_MODE: 'SAT', SAT_NAME: 'SO-50', MODE: 'FM', GRIDSQUARE: 'FN42', FREQ: '145.850', FREQ_RX: '436.795' }) +
      rec({ CALL: 'N0HF', QSO_DATE: '20261018', TIME_ON: '1500', MODE: 'SSB', SUBMODE: 'USB' }) +
      rec({ CALL: 'KX9X', QSO_DATE: '20261019', TIME_ON: '0100', PROP_MODE: 'SAT', SAT_NAME: 'RS-44', MODE: 'SSB', SUBMODE: 'USB', VUCC_GRIDS: 'EM10,EM11' });
    const r = importAdif(text, [so50], [], station, location, 999);
    expect(r.notSatellite).toBe(1);
    expect(r.qsos).toHaveLength(2);
    const [a, b] = r.qsos;
    expect(a).toMatchObject({ call: 'K1ABC', timeOn: T, satNoradId: 27607, satDisplayName: 'SO-50', gridsquare: 'FN42', mode: 'FM', myGridsquare: 'CN87', stationCallsign: 'W7LIT', exportedAt: 999 });
    expect(a!.freqRxHz).toBe(436_795_000); // lint-allow-number: test value
    expect(b).toMatchObject({ satNoradId: 0, satName: 'RS-44', satDisplayName: 'RS-44', mode: 'USB', gridsquare: 'EM10' });
    expect(b!.note).toMatch(/VUCC_GRIDS EM10,EM11/);
  });

  it('skips duplicates of what is already in the log, and within the file', () => {
    const one = rec({ CALL: 'K1ABC', QSO_DATE: '20261018', TIME_ON: '140509', PROP_MODE: 'SAT', SAT_NAME: 'SO-50' });
    const existing = [{ call: 'K1ABC', timeOn: T + 20_000, satName: 'SO-50', satDisplayName: 'SO-50' } as QsoRecord];
    expect(importAdif(one + one, [so50], [], station, location, 0).duplicates).toBe(1);
    expect(importAdif(one, [so50], existing, station, location, 0)).toMatchObject({ qsos: [], duplicates: 1 });
  });

  it('round-trips our own export', () => {
    const q: QsoRecord = {
      id: 'x', call: 'K1ABC', timeOn: T, satNoradId: 27607, satName: 'SO-50', satDisplayName: 'SO-50', transmitterId: 't',
      freqHz: 145_850_000, freqRxHz: 436_795_000, mode: 'FM', gridsquare: 'FN42', myGridsquare: 'CN87', // lint-allow-number: test value
      stationCallsign: 'W7LIT', locationId: 'home', recordingId: null, exportedAt: null, note: null,
    };
    const [back] = importAdif(toAdif([q], 0), [so50], [], station, location, 5).qsos;
    expect(back).toMatchObject({ ...q, id: back!.id, transmitterId: '', exportedAt: 5 });
  });
});
