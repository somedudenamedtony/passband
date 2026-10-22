// SPEC-v2 §6.6: the log grouped by pass, newest first. Contacts made on a pass sit under it;
// contacts with no pass (imported, added by hand for an old pass) sit under their local day.

import { DAY, MINUTE } from './time';
import { passId, type PassId } from './passId';
import type { Pass, QsoRecord } from './types';

export type LogGroup =
  | { kind: 'pass'; passId: PassId; noradId: number; satDisplayName: string; at: number; qsos: QsoRecord[] }
  | { kind: 'day'; day: number; at: number; qsos: QsoRecord[] };

function localDay(t: number): number {
  return Math.floor((t - new Date(t).getTimezoneOffset() * MINUTE) / DAY);
}

/** `qsos` newest first, as the log stores them; groups come out newest first too. */
export function groupLog(qsos: readonly QsoRecord[]): LogGroup[] {
  const groups: LogGroup[] = [];
  const byKey = new Map<string, LogGroup>();
  for (const q of qsos) {
    const key = q.passId ? `p:${q.passId}` : `d:${localDay(q.timeOn)}`;
    let g = byKey.get(key);
    if (!g) {
      g = q.passId
        ? { kind: 'pass', passId: q.passId, noradId: q.satNoradId, satDisplayName: q.satDisplayName, at: q.timeOn, qsos: [] }
        : { kind: 'day', day: localDay(q.timeOn), at: q.timeOn, qsos: [] };
      byKey.set(key, g);
      groups.push(g);
    }
    g.qsos.push(q);
  }
  return groups.sort((a, b) => b.at - a.at);
}

/** A contact belongs to a pass if it was made between AOS and a little after LOS (clocks drift). */
const GRACE = 2 * MINUTE;

/** The pass a contact was made on, from passes predicted for its satellite and location. */
export function passFor(q: Pick<QsoRecord, 'satNoradId' | 'timeOn'>, passes: readonly Pass[]): PassId | null {
  const p = passes.find((x) => x.noradId === q.satNoradId && q.timeOn >= x.aos - GRACE && q.timeOn <= x.los + GRACE);
  return p ? passId(p.noradId, p.aos) : null;
}
