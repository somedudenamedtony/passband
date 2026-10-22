// SPEC-v2 D23 and D26: how a pass reads at a glance. The phase it's in, how good it is, which way it
// goes, which part of the day it belongs to, and the one sentence on Now. Display logic only; the
// pass itself comes from the worker (D3).

import { compassPoint, compassWord, formatCountdown, formatLocalTime } from './format';
import { DAY, HOUR, MINUTE } from './time';
import type { Pass } from './types';

export type Quality = 'low' | 'fair' | 'great';

export function quality(maxElDeg: number, t: { fair: number; great: number }): Quality {
  return maxElDeg >= t.great ? 'great' : maxElDeg >= t.fair ? 'fair' : 'low';
}

/** Steps lit on the three-step bar, so quality never rests on colour alone (SPEC-v2 §8). */
export const QUALITY_STEPS: Record<Quality, number> = { low: 1, fair: 2, great: 3 };

export type Phase = 'before' | 'soon' | 'during' | 'after' | 'past';

/** Soon starts this long before AOS; After lasts this long past LOS (D23). */
export const SOON = 10 * MINUTE;
export const AFTER = 2 * HOUR;

export function phaseOf(pass: Pick<Pass, 'aos' | 'los'>, now: number, soonMs = SOON): Phase {
  if (now < pass.aos - soonMs) return 'before';
  if (now < pass.aos) return 'soon';
  if (now < pass.los) return 'during';
  if (now < pass.los + AFTER) return 'after';
  return 'past';
}

/** "SW → NE" */
export function direction(pass: Pick<Pass, 'aosAzDeg' | 'losAzDeg'>): string {
  return `${compassPoint(pass.aosAzDeg)} → ${compassPoint(pass.losAzDeg)}`;
}

/** Days since the epoch in local time. Display only (CLAUDE.md #4). */
function localDay(t: number): number {
  return Math.floor((t - new Date(t).getTimezoneOffset() * MINUTE) / DAY);
}

function localHourOf(t: number): number {
  return new Date(t).getHours();
}

/**
 * Which part of the day a pass belongs to, for Now's groups. A pass in the dark before dawn
 * belongs to the night before it: 2 a.m. is still "Tonight" to someone who hasn't slept.
 */
export function dayPart(aos: number, now: number, sunDown: boolean): string {
  const nightOfPreviousDay = sunDown && localHourOf(aos) < 12;
  const day = localDay(aos) - (nightOfPreviousDay ? 1 : 0);
  const offset = day - localDay(now);
  const night = sunDown;
  if (offset <= 0) return night ? 'Tonight' : 'Today';
  if (offset === 1) return night ? 'Tomorrow night' : 'Tomorrow';
  return night ? 'Later, night' : 'Later';
}

function when(pass: Pick<Pass, 'aos' | 'los' | 'aosAzDeg' | 'losAzDeg'>, now: number): string {
  if (now >= pass.aos && now < pass.los) return `Up now, sets in the ${compassWord(pass.losAzDeg)} ${formatCountdown(pass.los - now)}`;
  const at = pass.aos - now < HOUR ? formatCountdown(pass.aos - now) : `at ${formatLocalTime(pass.aos)}`;
  return `Rises in the ${compassWord(pass.aosAzDeg)} ${at}`;
}

const CLIMB: Record<Quality, string> = { low: 'stays low', fair: 'climbs part way', great: 'climbs high' };

/**
 * Now's one sentence: "Rises in the south-west in 23 min, climbs high, FM voice repeater, heard
 * lately." `what` and `onAir` come from the mode guide and the outlook, so nothing is invented (D6).
 */
export function passSentence(
  pass: Pick<Pass, 'aos' | 'los' | 'aosAzDeg' | 'losAzDeg' | 'maxElDeg'>,
  now: number,
  q: Quality,
  what: string,
  onAir: string,
): string {
  return `${[when(pass, now), CLIMB[q], what, onAir].filter(Boolean).join(', ')}.`;
}
