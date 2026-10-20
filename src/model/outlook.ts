// "Will it be on?" A pass can be high and long and still be silent: the satellite is off, only
// switched on by schedule, or starved of sunlight. This judges that from the overlay (D6) and the
// AMSAT reports in the catalog (D4), and says why in plain words. Unknown stays unknown.

import { HOUR } from './time';
import type { Pass, Satellite, StatusReport } from './types';

/**
 * How recent a "heard" report must be to count as heard lately, measured from when the catalog
 * fetched the reports, so a catalog a few days old offline doesn't turn every satellite quiet.
 */
export const HEARD_LATELY = 48 * HOUR;

export type Liveness =
  /** Heard recently, and more often heard than not. */
  | 'heard'
  /** Reported silent more than heard, or not heard for a while. */
  | 'quiet'
  /** AMSAT tracks it, but nobody reported it in the window. */
  | 'no-reports'
  /** AMSAT doesn't track it, or the build couldn't reach AMSAT. */
  | 'unknown';

export interface LivenessInfo {
  state: Liveness;
  heard: number | null;
  notHeard: number | null;
  lastHeard: number | null;
}

/** Report kinds that mean someone used or heard the transponder (not just its telemetry). */
const VOICE_HEARD = new Set<StatusReport['kind']>(['heard', 'crew_active']);

/**
 * Liveness from the AMSAT reports. With `mode` (AMSAT's label, e.g. "FM"), only reports for that
 * mode count: the ISS's APRS being heard says nothing about its FM repeater.
 */
export function liveness(sat: Satellite, mode: string | null = null): LivenessInfo {
  const r = sat.reports;
  if (!r || r.heard === null || r.notHeard === null) return { state: 'unknown', heard: null, notHeard: null, lastHeard: null };
  let heard = r.heard;
  let notHeard = r.notHeard;
  let lastHeard = r.lastHeard;
  if (r.latest) {
    const rows = mode === null ? r.latest : r.latest.filter((x) => x.mode === mode);
    const heardRows = rows.filter((x) => VOICE_HEARD.has(x.kind));
    heard = heardRows.length;
    notHeard = rows.filter((x) => x.kind === 'not_heard').length;
    lastHeard = heardRows[0]?.t ?? null;
  }
  const info = { heard, notHeard, lastHeard };
  if (heard === 0 && notHeard === 0) return { state: 'no-reports', ...info };
  if (lastHeard !== null && r.fetchedAt - lastHeard <= HEARD_LATELY && heard >= notHeard) return { state: 'heard', ...info };
  return { state: 'quiet', ...info };
}

/** AMSAT's mode label for the kind of transmitter a pass is worked through. */
export function amsatMode(sat: Satellite): string | null {
  const kinds = new Set(sat.transmitters.filter((t) => t.status !== 'inactive').map((t) => t.kind));
  return kinds.has('fm_repeater') ? 'FM' : null;
}

export type OutlookLevel = 'likely' | 'uncertain' | 'unlikely';

export interface Outlook {
  level: OutlookLevel;
  /** One short line for a list row. */
  short: string;
  /** A sentence for the card. */
  reason: string;
  liveness: LivenessInfo;
}

/** Below this share of the pass in sunlight, a sunlight-only satellite is called off. */
const SUNLIT_ENOUGH = 0.5;

export function passOutlook(pass: Pass, sat: Satellite, now: number): Outlook {
  const live = liveness(sat, amsatMode(sat));
  const op = sat.overlay.operation ?? null;
  const lit = pass.sunlitFraction;
  const out = (level: OutlookLevel, short: string, reason: string): Outlook => ({ level, short, reason, liveness: live });

  if (sat.status === 'inactive') return out('unlikely', 'inactive', `${sat.name} is reported inactive.`);
  if (op === 'scheduled') {
    return out(
      'unlikely',
      'schedule only',
      `${sat.name} is only switched on for announced passes. Check the operators’ schedule before going out.`,
    );
  }
  if (op === 'sunlit' && lit !== null && lit < SUNLIT_ENOUGH) {
    return out('unlikely', 'in shadow', `${sat.name} only works in sunlight, and it is in the Earth’s shadow for this pass.`);
  }
  if (live.state === 'quiet') {
    const heardBit = live.lastHeard === null ? 'not heard' : `last heard ${ageWords(now - live.lastHeard)} ago`;
    return out(
      'unlikely',
      'quiet lately',
      `Quiet lately: ${live.heard} heard, ${live.notHeard} silent in recent AMSAT reports, ${heardBit}.`,
    );
  }
  if (op === 'sunlit' && lit !== null && lit < 1) {
    return out('uncertain', 'part shadow', `${sat.name} only works in sunlight, and part of this pass is in shadow.`);
  }
  if (live.state === 'no-reports') return out('uncertain', 'no reports', `No recent AMSAT reports for ${sat.name}.`);
  if (live.state === 'unknown') return out('uncertain', '', `No status reports for ${sat.name}; status Unknown.`);
  return out(
    'likely',
    'heard',
    `Heard ${ageWords(now - live.lastHeard!)} ago · ${live.heard} heard, ${live.notHeard} silent in recent AMSAT reports.`,
  );
}

function ageWords(ms: number): string {
  const h = Math.max(0, ms) / HOUR;
  if (h < 1) return 'under an hour';
  if (h < 48) return `${Math.round(h)} h`;
  return `${Math.round(h / 24)} days`;
}
