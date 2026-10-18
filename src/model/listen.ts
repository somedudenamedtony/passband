// §5.5 "Listen tonight": what a listener will actually hear, derived from the transmitter.

import type { Satellite, Transmitter } from './types';

export function whatYoullHear(tx: Transmitter): string {
  const mode = tx.mode.toUpperCase();
  if (mode === 'SSTV') return 'Slow-scan TV: warbling tones that a phone app turns into a picture.';
  if (mode === 'APRS') return 'Short buzzing data bursts: position reports and messages relayed by the satellite.';
  switch (tx.kind) {
    case 'fm_repeater':
      return 'Hams making quick contacts: callsigns and grid squares, a few seconds each.';
    case 'linear_transponder':
      return 'Several SSB and CW conversations at once, spread across the passband. Needs an SSB receiver.';
    case 'digipeater':
      return 'Short data bursts relayed by the satellite.';
    case 'beacon':
      if (mode === 'CW') return 'A Morse code beacon repeating the satellite’s callsign and status.';
      if (mode === 'FM') return 'An FM beacon or voice announcement.';
      return `A ${tx.mode} telemetry beacon: tones or buzzing that decoding software reads.`;
    default:
      return `${tx.mode} signals from the satellite.`;
  }
}

/** The transmitter a listener should tune to: a working downlink, voice first. */
export function listeningTransmitter(sat: Satellite): Transmitter | null {
  const rank = (t: Transmitter) =>
    (t.status === 'active' ? 0 : t.status === 'unknown' ? 10 : 100) +
    ({ fm_repeater: 0, beacon: 1, digipeater: 2, linear_transponder: 3, other: 4 } as const)[t.kind];
  return [...sat.transmitters].filter((t) => t.downlinkHz !== null && t.status !== 'inactive').sort((a, b) => rank(a) - rank(b))[0] ?? null;
}
