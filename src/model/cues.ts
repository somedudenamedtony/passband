// D14: what the live screen says, and when. Pure: the output channel is cue/cue.ts.

import { compassWord } from './format';
import type { RetuneSchedule } from './schedule';
import { SECOND } from './time';
import type { TrackPoint } from './track';
import type { Pass, Station } from './types';

export interface CueEvent {
  t: number;
  kind: 'info' | 'retune' | 'alert';
  text: string;
  /**
   * Whether speech may read it. A phone talking during the pass talks over the downlink, and into
   * the microphone if it fires while you transmit; unspoken cues play as a tone instead.
   */
  speak: boolean;
}

/** "436.800" → "4 3 6 point 8 0 0", so speech engines read digits, not "four hundred…". */
export function speakableMHz(mhz: string): string {
  const [whole = '', frac = ''] = mhz.split('.');
  const digits = (s: string) => s.split('').join(' ');
  return frac ? `${digits(whole)} point ${digits(frac)}` : digits(whole);
}

export function passCues(
  satName: string,
  pass: Pass,
  track: readonly TrackPoint[],
  schedule: RetuneSchedule | null,
  formatMHz: (hz: number) => string,
  voice: Station['speakInPass'] = 'all',
): CueEvent[] {
  const out: Array<Omit<CueEvent, 'speak'>> = [];
  const rise = compassWord(pass.aosAzDeg);
  const set = compassWord(pass.losAzDeg);
  out.push({ t: pass.aos - 120 * SECOND, kind: 'info', text: `${satName} rises in two minutes, in the ${rise}.` });

  const first = schedule?.steps[0];
  let aosText = `${satName} is up. Rising in the ${rise}.`;
  if (first && schedule?.tuneSide === 'downlink' && first.downlinkHz !== null) {
    aosText += ` Listen on ${speakableMHz(formatMHz(first.downlinkHz))}.`;
  } else if (first && schedule?.tuneSide === 'uplink' && first.uplinkHz !== null) {
    aosText += ` Transmit on ${speakableMHz(formatMHz(first.uplinkHz))}.`;
  }
  out.push({ t: pass.aos, kind: 'alert', text: aosText });

  for (const step of schedule?.steps.slice(1) ?? []) {
    const hz = schedule?.tuneSide === 'uplink' ? step.uplinkHz : step.downlinkHz;
    if (hz !== null) out.push({ t: step.t, kind: 'retune', text: `Retune: ${speakableMHz(formatMHz(hz))}.` });
  }

  const peak = track.reduce<TrackPoint | null>((m, p) => (!m || p.elDeg > m.elDeg ? p : m), null);
  if (peak) {
    out.push({
      t: pass.tca,
      kind: 'info',
      text: `Peak. Elevation ${Math.round(pass.maxElDeg)}, in the ${compassWord(peak.azDeg)}.`,
    });
  }
  if (pass.los - pass.aos > 3 * 60 * SECOND) {
    out.push({ t: pass.los - 60 * SECOND, kind: 'info', text: `Setting in one minute, in the ${set}.` });
  }
  out.push({ t: pass.los, kind: 'alert', text: `${satName} has set. Pass over.` });

  // 'key': rise, peak and set are spoken; retunes are a tone. 'none': nothing spoken between AOS
  // and LOS. The announcements at AOS and LOS themselves are spoken in every mode.
  const speak = (e: Omit<CueEvent, 'speak'>) =>
    voice === 'all' || (voice === 'key' ? e.kind !== 'retune' : e.t <= pass.aos || e.t >= pass.los);

  // A cue that lands on top of another gets merged into it rather than talked over, when both are
  // spoken the same way.
  out.sort((a, b) => a.t - b.t);
  const merged: CueEvent[] = [];
  for (const raw of out) {
    const e = { ...raw, speak: speak(raw) };
    const prev = merged[merged.length - 1];
    if (prev && e.t - prev.t < 3 * SECOND && prev.speak === e.speak) {
      prev.text = `${prev.text} ${e.text}`;
      if (e.kind === 'alert') prev.kind = 'alert';
    } else merged.push(e);
  }
  return merged;
}

/** Events that became due as the clock moved from `prev` to `now`. A jump (practice seek, a
 * sleeping tab) fires nothing, so the user isn't read a backlog of stale instructions. */
export function dueCues(events: readonly CueEvent[], prev: number, now: number, maxGapMs = 5 * SECOND): CueEvent[] {
  if (now <= prev || now - prev > maxGapMs) return [];
  return events.filter((e) => e.t > prev && e.t <= now);
}
