// D7: frequencies are integer Hz in the model. These are the edge.

/** 436795000 → "436.795". Three decimals, or more if the value needs it (e.g. 145.8125). */
export function formatMHz(hz: number): string {
  const mhz = Math.trunc(hz / 1e6);
  const rest = String(Math.abs(hz % 1e6)).padStart(6, '0').replace(/0+$/, '');
  return `${mhz}.${rest.padEnd(3, '0')}`;
}

/** Signed offset in kHz, e.g. "+9.6 kHz". */
export function formatOffsetKHz(hz: number): string {
  const k = hz / 1000;
  const sign = k > 0 ? '+' : k < 0 ? '−' : '±';
  return `${sign}${Math.abs(k).toFixed(1)} kHz`;
}

/** CTCSS for display. D6: unknown is a real value, and blank would mean "no tone". */
export function formatTone(ctcss: number | null | 'unknown'): string {
  if (ctcss === 'unknown') return 'Tone unknown';
  if (ctcss === null) return 'No tone';
  return `${ctcss.toFixed(1)} Hz`;
}
