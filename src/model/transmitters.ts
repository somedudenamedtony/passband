import type { Satellite, Transmitter } from './types';

const KIND_RANK: Record<Transmitter['kind'], number> = {
  fm_repeater: 0,
  linear_transponder: 1,
  digipeater: 2,
  beacon: 3,
  other: 4,
};

const STATUS_RANK: Record<Transmitter['status'], number> = { active: 0, unknown: 1, inactive: 2 };

/** The transmitter a pass card leads with: working first, then voice FM, then the rest. */
export function primaryTransmitter(sat: Satellite): Transmitter | null {
  const sorted = [...sat.transmitters].sort(
    (a, b) => STATUS_RANK[a.status] - STATUS_RANK[b.status] || KIND_RANK[a.kind] - KIND_RANK[b.kind],
  );
  return sorted[0] ?? null;
}

/** A satellite you can transmit to: some transmitter with an uplink that isn't known to be dead. */
export function hasWorkingUplink(sat: Satellite): boolean {
  return sat.transmitters.some((t) => t.uplinkHz !== null && t.status !== 'inactive');
}
