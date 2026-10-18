// ADIF band enumeration (ADIF 3.1 §III.B.4), for BAND and BAND_RX (D12). These are band-plan
// definitions, not satellite frequencies, so they live in source — in kHz, to keep integer Hz
// literals out of src/ (§10). A test checks them against TQSL's own table.

const BANDS_KHZ: ReadonlyArray<readonly [number, number, string]> = [
  [21_000, 21_450, '15m'],
  [24_890, 24_990, '12m'],
  [28_000, 29_700, '10m'],
  [50_000, 54_000, '6m'],
  [144_000, 148_000, '2m'],
  [220_000, 225_000, '1.25m'],
  [420_000, 450_000, '70cm'],
  [902_000, 928_000, '33cm'],
  [1_240_000, 1_300_000, '23cm'],
  [2_300_000, 2_450_000, '13cm'],
  [3_300_000, 3_500_000, '9cm'],
  [5_650_000, 5_925_000, '6cm'],
  [10_000_000, 10_500_000, '3cm'],
];

/** ADIF band name for an integer-Hz frequency, or null outside the bands satellites use. */
export function adifBand(hz: number): string | null {
  const khz = hz / 1000;
  return BANDS_KHZ.find(([lo, hi]) => khz >= lo && khz <= hi)?.[2] ?? null;
}

export function adifBandTable(): ReadonlyArray<{ name: string; lowHz: number; highHz: number }> {
  return BANDS_KHZ.map(([lo, hi, name]) => ({ name, lowHz: lo * 1000, highHz: hi * 1000 }));
}
