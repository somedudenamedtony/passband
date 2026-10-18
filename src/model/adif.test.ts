import { describe, expect, it } from 'vitest';
import tqsl from '../test/fixtures/tqsl.json';
import { parseUtcInput, formatUtcInput } from '../ui/LogView';
import { adifFreq, adifMode, lotwProblems, parseAdif, toAdif } from './adif';
import { adifBand, adifBandTable } from './bands';
import type { QsoRecord } from './types';

// Fixture values, not shipped frequencies (D6).
const qso: QsoRecord = {
  id: 'q1',
  call: 'K1ABC',
  // 2026-10-18 23:59:59 UTC — late enough that local time in the Americas is the previous day.
  timeOn: Date.UTC(2026, 9, 18, 23, 59, 59),
  satNoradId: 27607,
  satName: 'SO-50',
  satDisplayName: 'SO-50',
  transmitterId: 't',
  freqHz: 145_850_000,
  freqRxHz: 436_805_000,
  mode: 'FM',
  gridsquare: 'FN42',
  myGridsquare: 'CN87',
  stationCallsign: 'W7LIT',
  locationId: 'l',
  recordingId: null,
  exportedAt: null,
  note: null,
};

describe('ADIF (D12, §10)', () => {
  const text = toAdif([qso, { ...qso, id: 'q2', call: 'N0CALL', mode: 'USB', gridsquare: null, note: 'café' }], qso.timeOn);
  const recs = parseAdif(text);

  it('round-trips', () => {
    expect(recs).toHaveLength(2);
    expect(recs[0]).toMatchObject({
      CALL: 'K1ABC',
      GRIDSQUARE: 'FN42',
      MY_GRIDSQUARE: 'CN87',
      STATION_CALLSIGN: 'W7LIT',
      FREQ: '145.85',
      FREQ_RX: '436.805',
      BAND: '2m',
      BAND_RX: '70cm',
      MODE: 'FM',
    });
  });
  it('carries PROP_MODE=SAT and the LoTW SAT_NAME', () => {
    for (const r of recs) {
      expect(r.PROP_MODE).toBe('SAT');
      expect(r.SAT_NAME).toBe('SO-50');
    }
  });
  it('writes times in UTC', () => {
    expect(recs[0]!.QSO_DATE).toBe('20261018');
    expect(recs[0]!.TIME_ON).toBe('235959');
  });
  it('maps sideband to MODE=SSB with SUBMODE, and keeps lengths right for non-ASCII notes', () => {
    expect(recs[1]).toMatchObject({ MODE: 'SSB', SUBMODE: 'USB', COMMENT: 'caf?' });
    expect(recs[1]!.GRIDSQUARE).toBeUndefined();
  });
  it('formats integer Hz as MHz text exactly', () => {
    expect(adifFreq(145_812_500)).toBe('145.8125');
    expect(adifFreq(1_268_000_000)).toBe('1268');
  });
  it('flags what LoTW would reject', () => {
    expect(lotwProblems(qso)).toEqual([]);
    expect(lotwProblems({ ...qso, satName: null, stationCallsign: '' })).toEqual([
      'No LoTW satellite name',
      'Your callsign is missing',
    ]);
  });
});

describe('agrees with TQSL’s own configuration', () => {
  it('band edges match TQSL', () => {
    for (const b of adifBandTable()) {
      const t = tqsl.bands.find((x) => x.name === b.name.toUpperCase());
      expect(t, b.name).toBeDefined();
      expect([b.lowHz, b.highHz]).toEqual([t!.lowHz, t!.highHz]);
    }
    expect(adifBand(436_805_000)).toBe('70cm');
  });
  it('every mode we export is one TQSL accepts', () => {
    for (const m of ['FM', 'USB', 'LSB', 'CW', 'PKT', 'APRS', 'SSTV']) {
      const { mode, submode } = adifMode(m);
      const ok = tqsl.adifModes.some((a) => a.adifMode === mode && (a.adifSubmode === submode || a.adifSubmode === null));
      expect(ok, `${mode}/${submode}`).toBe(true);
    }
    expect(tqsl.propModes).toContain('SAT');
  });
});

describe('UTC time entry', () => {
  it('round-trips and rejects junk', () => {
    expect(parseUtcInput(formatUtcInput(qso.timeOn))).toBe(qso.timeOn);
    expect(parseUtcInput('2026-10-18 07:05')).toBe(Date.UTC(2026, 9, 18, 7, 5));
    expect(parseUtcInput('yesterday')).toBeNull();
  });
});
