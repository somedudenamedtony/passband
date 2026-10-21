import { listeningTransmitter } from './listen';
import { adifBand } from './bands';
import { primaryTransmitter } from './transmitters';
import type { Satellite, Station, Transmitter } from './types';

export function operatorPreferences(station: Station) {
  const beginner = station.experience === 'new';
  return {
    tips: station.showTips ?? beginner,
    compact: station.compactDetails ?? !beginner,
    view: station.liveView ?? (beginner ? 'compass' : 'sky'),
    cues: station.liveCues ?? beginner,
  } as const;
}

export function supportsTransmitter(tx: Transmitter, station: Station): boolean {
  if (station.goal === 'explore') return true;
  if (station.goal === 'contacts' && (tx.uplinkHz === null || station.equipment === 'sdr')) return false;
  if (station.goal === 'listen' && tx.downlinkHz === null) return false;
  if (station.equipment === 'fm') {
    const covered = (hz: number | null) => hz !== null && ['2m', '70cm'].includes(adifBand(hz) ?? '');
    return (/^FM$/i.test(tx.mode) || tx.kind === 'fm_repeater') && covered(tx.downlinkHz)
      && (station.goal !== 'contacts' || covered(tx.uplinkHz));
  }
  return true;
}

/** Use the same transmitter for recommendations, preparation, live tracking and logging. */
export function operatingTransmitter(sat: Satellite, station: Station): Transmitter | null {
  const compatible = sat.transmitters.filter((tx) => tx.status !== 'inactive' && supportsTransmitter(tx, station));
  const candidate = { ...sat, transmitters: compatible };
  return (station.goal === 'listen' ? listeningTransmitter(candidate) : primaryTransmitter(candidate))
    ?? primaryTransmitter(sat);
}

export function matchesOperator(sat: Satellite, station: Station): boolean {
  return sat.transmitters.some((tx) => tx.status !== 'inactive' && supportsTransmitter(tx, station));
}

export function recommendationReason(sat: Satellite, station: Station): string {
  const tx = operatingTransmitter(sat, station);
  if (!tx) return 'Transmitter details are unknown. Check the satellite profile before preparing.';
  if (!supportsTransmitter(tx, station)) return 'This target may need a different radio or operating goal. Check its equipment requirements.';
  const mode = tx.kind === 'fm_repeater' ? 'FM voice' : tx.kind === 'linear_transponder' ? 'SSB / CW' : tx.mode || 'Unknown mode';
  const purpose = station.goal === 'listen' ? 'Listening target' : station.goal === 'contacts' ? 'Two-way target' : 'Explore this target';
  const radio = station.equipment === 'unknown' ? 'check the equipment below' : station.equipment === 'fm' ? 'suits a dual-band FM radio' : station.equipment === 'sdr' ? 'receive with your SDR' : 'check the bands your radio covers';
  return `${purpose}: ${mode}; ${radio}.`;
}
