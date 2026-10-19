// What you can do with a satellite, from its catalog transmitters (D4). Used to break a long
// satellite list into groups a person can reason about: most of the catalog is cubesats that only
// send telemetry, and the few you can talk through are what most operators are looking for.

import type { Satellite, Transmitter } from './types';

export type Activity = 'voice' | 'ssb' | 'packet' | 'images' | 'telemetry';

/** In the order they're offered: two-way first, the long receive-only tail last. */
export const ACTIVITIES: ReadonlyArray<{ id: Activity; label: string; hint: string }> = [
  { id: 'voice', label: 'Talk (FM)', hint: 'FM voice repeaters: a handheld and a small antenna will do.' },
  { id: 'ssb', label: 'SSB / CW', hint: 'Linear transponders: SSB or CW, full duplex.' },
  { id: 'packet', label: 'Packet / APRS', hint: 'Digipeaters for APRS and other packet.' },
  { id: 'images', label: 'Images', hint: 'SSTV and other pictures sent down from orbit.' },
  { id: 'telemetry', label: 'Telemetry only', hint: 'Beacons to listen to and decode, and nothing else.' },
];

function activityOf(t: Transmitter): Activity {
  const mode = t.mode.toUpperCase();
  if (mode === 'SSTV' || mode === 'SSDV') return 'images';
  if (t.kind === 'fm_repeater') return 'voice';
  if (t.kind === 'linear_transponder') return 'ssb';
  if (t.kind === 'digipeater' || mode === 'APRS') return 'packet';
  if (mode === 'FM' && t.uplinkHz !== null) return 'voice';
  return 'telemetry';
}

/**
 * Everything a satellite offers, ignoring transmitters reported dead. Almost every satellite has a
 * beacon, so telemetry counts only when there is nothing else: it means "listen only".
 */
export function activities(sat: Satellite): Set<Activity> {
  const all = new Set(sat.transmitters.filter((t) => t.status !== 'inactive').map(activityOf));
  if (all.size > 1) all.delete('telemetry');
  return all;
}

/** No activities chosen means no filter. */
export function matchesActivities(sat: Satellite, chosen: ReadonlySet<Activity>): boolean {
  if (chosen.size === 0) return true;
  for (const a of activities(sat)) if (chosen.has(a)) return true;
  return false;
}
