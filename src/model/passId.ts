// D23: a pass has a stable id, so plans, contacts and recordings can point at it and a URL can
// name it. AOS is rounded to the minute: re-predicting from fresher elements moves AOS by seconds,
// and the id must survive that.

import { MINUTE } from './time';

export type PassId = string;

export function passId(noradId: number, aosMs: number): PassId {
  return `${noradId}-${Math.round(aosMs / MINUTE) * MINUTE}`;
}

export function parsePassId(id: string): { noradId: number; aosMinuteMs: number } | null {
  const m = /^(\d{1,9})-(\d{1,15})$/.exec(id);
  if (!m) return null;
  const aosMinuteMs = Number(m[2]);
  if (aosMinuteMs % MINUTE !== 0) return null;
  return { noradId: Number(m[1]), aosMinuteMs };
}
