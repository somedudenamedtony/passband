// D5: a prediction is only as good as its elements.

import { DAY } from './time';

export type ElementAgeLevel = 'fresh' | 'aging' | 'stale';

export function elementAgeDays(epochMs: number, nowMs: number): number {
  return (nowMs - epochMs) / DAY;
}

export function elementAgeLevel(epochMs: number, nowMs: number): ElementAgeLevel {
  const days = elementAgeDays(epochMs, nowMs);
  if (days < 3) return 'fresh';
  if (days <= 14) return 'aging';
  return 'stale';
}

export function formatElementAge(epochMs: number, nowMs: number): string {
  const days = elementAgeDays(epochMs, nowMs);
  if (days < 1) {
    const hours = Math.max(0, Math.round(days * 24));
    return hours === 1 ? '1 hour old' : `${hours} hours old`;
  }
  const d = Math.floor(days);
  return d === 1 ? '1 day old' : `${d} days old`;
}
