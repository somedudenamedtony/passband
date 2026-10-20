import { describe, expect, it } from 'vitest';
import { json2satrec, propagate, twoline2satrec } from 'satellite.js';
import {
  buildCatalog,
  displayName,
  inScopeTransmitter,
  mapKind,
  parseCtcss,
  summariseAmsat,
  satelliteStatus,
  tleToOmm,
  withRetry,
  type SatnogsTransmitter,
} from './catalog-lib.ts';

const tx = (over: Partial<SatnogsTransmitter>): SatnogsTransmitter => ({
  uuid: 'u1',
  description: 'Mode V/U FM',
  alive: true,
  type: 'Transceiver',
  uplink_low: 145_850_000,
  uplink_high: null,
  downlink_low: 436_795_000,
  downlink_high: null,
  mode: 'FM',
  invert: false,
  norad_cat_id: 27607,
  status: 'active',
  ...over,
});

describe('scope (D4)', () => {
  it('includes anything touching 2 m or 70 cm', () => {
    expect(inScopeTransmitter(tx({}))).toBe(true);
    expect(inScopeTransmitter(tx({ uplink_low: 1_263_500_000, downlink_low: 145_895_000 }))).toBe(true);
    expect(inScopeTransmitter(tx({ uplink_low: null, downlink_low: 29_400_000 }))).toBe(false);
    expect(inScopeTransmitter(tx({ uplink_low: null, downlink_low: 2_401_000_000 }))).toBe(false);
  });
});

describe('CTCSS (D6)', () => {
  it('reads the tone from the description', () => {
    expect(parseCtcss(tx({ description: 'Mode V/U FM Voice CTCSS 67.0 Hz' }))).toBe(67);
    expect(parseCtcss(tx({ description: 'V/U FM Voice (PL 88.5Hz)' }))).toBe(88.5);
    expect(parseCtcss(tx({ description: 'Mode V/U FM 67.0 PL' }))).toBe(67);
  });
  it('knows "no tone" when the source says so', () => {
    expect(parseCtcss(tx({ description: 'Mode U/V FM Voice (no CTCSS any longer)' }))).toBeNull();
  });
  it('says unknown — never "none" — for an FM uplink that does not mention a tone', () => {
    expect(parseCtcss(tx({ description: 'FM VOICE' }))).toBe('unknown');
  });
  it('null for non-FM, where a tone does not apply', () => {
    expect(parseCtcss(tx({ mode: 'USB', type: 'Transponder', description: 'Linear' }))).toBeNull();
  });
});

describe('mapping', () => {
  it('classifies transmitters', () => {
    expect(mapKind(tx({}))).toBe('fm_repeater');
    expect(mapKind(tx({ type: 'Transponder', mode: 'USB' }))).toBe('linear_transponder');
    expect(mapKind(tx({ mode: 'AFSK', description: 'APRS', uplink_low: 145_825_000, downlink_low: 145_825_000 }))).toBe(
      'digipeater',
    );
    expect(mapKind(tx({ uplink_low: null }))).toBe('beacon');
  });
  it('never invents Active (D6)', () => {
    const t = (status: 'active' | 'inactive' | 'unknown') => ({ status }) as never;
    expect(satelliteStatus([])).toBe('unknown');
    expect(satelliteStatus([t('inactive'), t('inactive')])).toBe('inactive');
    expect(satelliteStatus([t('inactive'), t('unknown')])).toBe('unknown');
    expect(satelliteStatus([t('inactive'), t('active')])).toBe('active');
  });
  it('prefers an OSCAR designator for the display name', () => {
    expect(displayName({ norad_cat_id: 1, name: 'FOX-1B', names: 'AO-91, RADFXSAT', status: 'in orbit' })).toBe('AO-91');
    expect(displayName({ norad_cat_id: 1, name: 'ISS', names: 'ZARYA, RS0ISS', status: 'in orbit' })).toBe('ISS');
  });
});

describe('TLE → OMM', () => {
  const l1 = '1 25544U 98067A   26290.82202591  .00007563  00000-0  14569-3 0  9997';
  const l2 = '2 25544  51.6326  53.2215 0006766 277.4279  82.5940 15.48913056590763';
  it('propagates to the same place as the TLE itself', () => {
    const a = twoline2satrec(l1, l2);
    const b = json2satrec(tleToOmm('0 ISS (ZARYA)', l1, l2));
    const t = new Date(Date.UTC(2026, 9, 18, 12));
    const pa = propagate(a, t)!.position;
    const pb = propagate(b, t)!.position;
    expect(Math.hypot(pa.x - pb.x, pa.y - pb.y, pa.z - pb.z)).toBeLessThan(0.01); // km
  });
});

describe('buildCatalog', () => {
  const omm = tleToOmm(
    'SO-50',
    '1 27607U 02058C   26290.50000000  .00000100  00000-0  20000-4 0  9990',
    '2 27607  64.5000 100.0000 0050000 100.0000 260.0000 14.80000000100000',
  );
  const base = {
    generatedAt: 1,
    elements: [omm],
    fallbackElements: [],
    satnogsSatellites: [{ norad_cat_id: 27607, name: 'SAUDISAT 1C', names: 'SO-50', status: 'in orbit' }],
    satnogsTransmitters: [tx({ description: 'FM VOICE' }), tx({ uuid: 'u2', uplink_low: null, downlink_low: 2_401_000_000 })],
  };

  it('keeps only in-scope transmitters, applies cited overrides, and records curation', () => {
    const { catalog } = buildCatalog({
      ...base,
      overlay: [
        {
          noradId: 27607,
          lotwName: 'SO-50',
          difficulty: 'beginner',
          note: null,
          receiveOnly: false,
          operation: 'sunlit',
          operationSource: 'test',
          transmitterOverrides: [{ id: 'u1', source: 'test', set: { ctcssHz: 67 } }],
        },
      ],
    });
    const s = catalog.satellites[0]!;
    expect(s.transmitters).toHaveLength(1);
    expect(s.transmitters[0]!.ctcssHz).toBe(67);
    expect(s.lotwName).toBe('SO-50');
    expect(s.overlay.curated).toBe(true);
    expect(s.overlay.operation).toBe('sunlit');
    expect(s.elementsSource).toBe('celestrak-omm');
    expect(Number.isInteger(s.transmitters[0]!.uplinkHz)).toBe(true);
  });

  it('publishes uncurated satellites with Unknown overlay fields', () => {
    const { catalog, report } = buildCatalog({ ...base, overlay: [] });
    const s = catalog.satellites[0]!;
    expect(s.overlay).toEqual({ curated: false, difficulty: null, note: null, receiveOnly: false, operation: null });
    expect(s.transmitters[0]!.ctcssHz).toBe('unknown');
    expect(report.uncuratedWithUplink).toEqual(['SO-50']);
  });

  it('falls back to SatNOGS elements only when CelesTrak lacks the satellite', () => {
    const { catalog } = buildCatalog({ ...base, elements: [], fallbackElements: [omm], overlay: [] });
    expect(catalog.satellites[0]!.elementsSource).toBe('satnogs-tle');
  });

  it('skips satellites with no elements and reports them', () => {
    const { catalog, report } = buildCatalog({ ...base, elements: [], overlay: [] });
    expect(catalog.satellites).toHaveLength(0);
    expect(report.missingElements).toEqual([{ noradId: 27607, name: 'SO-50' }]);
  });
});

describe('AMSAT status reports', () => {
  const row = (t: string, report: string, callsign = 'W7LIT', name = 'SO-50_[FM]') => ({
    name,
    reported_time: t,
    callsign,
    report,
    grid_square: 'CN87',
  });

  it('counts heard and not heard, newest first, with the mode from the AMSAT name', () => {
    const s = summariseAmsat(
      [
        row('2026-10-18T10:30:00Z', 'Heard'),
        row('2026-10-18T12:00:00Z', 'Not Heard', 'k1abc'),
        row('2026-10-18T11:00:00Z', 'Telemetry Only', 'W7LIT', 'ISS_[VHF_Digi]'),
      ],
      5,
    );
    expect(s).toMatchObject({ heard: 2, notHeard: 1, fetchedAt: 5, lastHeard: Date.parse('2026-10-18T11:00:00Z') });
    expect(s.latest!.map((r) => [r.callsign, r.kind, r.mode])).toEqual([
      ['K1ABC', 'not_heard', 'FM'],
      ['W7LIT', 'telemetry_only', 'VHF_Digi'],
      ['W7LIT', 'heard', 'FM'],
    ]);
  });

  it('keeps a failed fetch unknown, not zero (D6)', () => {
    expect(summariseAmsat(null, 5)).toMatchObject({ heard: null, notHeard: null, lastHeard: null, latest: null });
  });

  it('attaches reports only to satellites the build asked AMSAT about', () => {
    const omm = tleToOmm(
      'SO-50',
      '1 27607U 02058C   26290.50000000  .00000100  00000-0  20000-4 0  9990',
      '2 27607  64.5000 100.0000 0050000 100.0000 260.0000 14.80000000100000',
    );
    const base = {
      generatedAt: 1,
      elements: [omm],
      fallbackElements: [],
      satnogsSatellites: [{ norad_cat_id: 27607, name: 'SAUDISAT 1C', names: 'SO-50', status: 'in orbit' }],
      satnogsTransmitters: [tx({})],
      overlay: [],
    };
    expect(buildCatalog(base).catalog.satellites[0]!.reports).toBeUndefined();
    const withReports = buildCatalog({ ...base, amsatReports: new Map([[27607, [row('2026-10-18T10:30:00Z', 'Heard')]]]) });
    expect(withReports.catalog.satellites[0]!.reports?.heard).toBe(1);
  });
});

describe('withRetry', () => {
  const noSleep = async () => undefined;
  it('retries until success', async () => {
    let n = 0;
    const out = await withRetry(
      async () => {
        if (++n < 3) throw new Error('timeout');
        return 'ok';
      },
      [1, 1],
      noSleep,
    );
    expect(out).toBe('ok');
    expect(n).toBe(3);
  });
  it('gives up after the last delay and rethrows', async () => {
    let n = 0;
    await expect(
      withRetry(
        async () => {
          n++;
          throw new Error('down');
        },
        [1],
        noSleep,
      ),
    ).rejects.toThrow('down');
    expect(n).toBe(2);
  });
});
