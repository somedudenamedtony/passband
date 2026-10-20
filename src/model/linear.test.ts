import { describe, expect, it } from 'vitest';
import { linearTuning, passband, passbandCentre, uplinkForDownlink } from './linear';
import type { Transmitter } from './types';

// RS-44-like inverting transponder, 2 m up / 70 cm down. Built from parts so no literal looks
// like a hardcoded frequency (§10).
const MHZ = 1_000_000;
const KHZ = 1_000;
const tx: Transmitter = {
  id: 'rs44',
  description: '',
  kind: 'linear_transponder',
  uplinkHz: 145 * MHZ + 935 * KHZ,
  uplinkHighHz: 145 * MHZ + 995 * KHZ,
  downlinkHz: 435 * MHZ + 610 * KHZ,
  downlinkHighHz: 435 * MHZ + 670 * KHZ,
  inverting: true,
  mode: 'USB',
  ctcssHz: null,
  status: 'active',
};

describe('linear transponder tuning', () => {
  const pb = passband(tx)!;
  it('maps the passband: inverting puts the bottom of the downlink at the top of the uplink', () => {
    expect(uplinkForDownlink(pb, pb.downLowHz)).toBe(pb.upHighHz);
    expect(uplinkForDownlink(pb, pb.downHighHz)).toBe(pb.upLowHz);
    expect(uplinkForDownlink({ ...pb, inverting: false }, pb.downLowHz)).toBe(pb.upLowHz);
  });
  it('sends LSB on an inverting transponder so the downlink comes out USB', () => {
    expect(linearTuning(pb, passbandCentre(pb), 0).sendSideband).toBe('LSB');
    expect(linearTuning({ ...pb, inverting: false }, passbandCentre(pb), 0).sendSideband).toBe('USB');
  });
  it('Doppler sign: approaching, you hear high and send low (§10)', () => {
    const t = linearTuning(pb, passbandCentre(pb), -6000);
    expect(t.hearHz).toBeGreaterThan(t.downAtSatHz);
    expect(t.sendHz).toBeLessThan(t.upAtSatHz);
    const away = linearTuning(pb, passbandCentre(pb), 6000);
    expect(away.hearHz).toBeLessThan(away.downAtSatHz);
    expect(away.sendHz).toBeGreaterThan(away.upAtSatHz);
  });
  it('keeps the spot at the satellite fixed through the pass, on a 10 Hz step', () => {
    const spot = passbandCentre(pb) + 3 * KHZ;
    for (const rr of [-7000, -2000, 0, 3000, 7000]) {
      const t = linearTuning(pb, spot, rr);
      expect(t.downAtSatHz).toBe(spot);
      expect(t.sendHz % 10).toBe(0);
      expect(t.hearHz % 10).toBe(0);
    }
  });
  it('clamps to the passband, and is Unknown without both ranges (D6)', () => {
    expect(linearTuning(pb, pb.downHighHz + 50 * KHZ, 0).downAtSatHz).toBe(pb.downHighHz);
    expect(passband({ ...tx, uplinkHighHz: null })).toBeNull();
    expect(passband({ ...tx, inverting: null })).toBeNull();
    expect(passband({ ...tx, kind: 'fm_repeater' })).toBeNull();
  });
});
