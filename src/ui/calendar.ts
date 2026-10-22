// D17: build calendar events for passes and hand them to the phone's calendar.

import { compassWord, formatDuration } from '../model/format';
import { formatMHz, formatTone } from '../model/freq';
import { formatElementAge } from '../model/elementAge';
import { toIcs, type PassEvent } from '../model/ics';
import { primaryTransmitter } from '../model/transmitters';
import { operatingTransmitter } from '../model/operator';
import type { Pass, Satellite, Station } from '../model/types';
import { shareOrDownload } from './share';

export function passEvent(pass: Pass, sat: Satellite, now: number, station?: Station): PassEvent {
  const tx = station ? operatingTransmitter(sat, station) : primaryTransmitter(sat);
  const lines: string[] = [];
  if (tx?.downlinkHz != null) lines.push(`Listen: ${formatMHz(tx.downlinkHz)} MHz ${tx.mode}`);
  if (station?.goal !== 'listen' && tx?.uplinkHz != null) lines.push(`Transmit: ${formatMHz(tx.uplinkHz)} MHz · ${formatTone(tx.ctcssHz)}`);
  lines.push(
    `Rises in the ${compassWord(pass.aosAzDeg)}, up to ${Math.round(pass.maxElDeg)}°, sets in the ${compassWord(pass.losAzDeg)}.`,
    `${formatDuration(Math.round((pass.los - pass.aos) / 1000))} above the horizon.`,
    `Frequencies are nominal — open Passband for the Doppler retune schedule.`,
    `Predicted from elements ${formatElementAge(pass.elementsEpoch, now)}.`,
  );
  return {
    uid: `${sat.noradId}-${pass.aos}@passband`,
    start: pass.aos,
    end: pass.los,
    summary: `${sat.name} pass, up to ${Math.round(pass.maxElDeg)}°`,
    description: lines.join('\n'),
  };
}

export async function exportPassesToCalendar(passes: readonly Pass[], sat: Satellite, now: number, name: string, station?: Station): Promise<void> {
  const ics = toIcs(
    passes.map((p) => passEvent(p, sat, now, station)),
    now,
  );
  const file = new File([ics], `${name}.ics`, { type: 'text/calendar' });
  await shareOrDownload(file, name);
}

/** SPEC-v2 §6.4: every planned pass, across satellites, as one calendar file (D17). */
export async function exportPlannedToCalendar(items: ReadonlyArray<{ pass: Pass; sat: Satellite }>, now: number, station?: Station): Promise<void> {
  const ics = toIcs(items.map(({ pass, sat }) => passEvent(pass, sat, now, station)), now);
  await shareOrDownload(new File([ics], 'passband-plan.ics', { type: 'text/calendar' }), 'Planned passes');
}
