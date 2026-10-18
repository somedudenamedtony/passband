// Display-only formatting. Times in the model are UTC epoch ms; local time exists only here.

import { HOUR, MINUTE, SECOND } from './time';

const POINTS_8 = ['north', 'north-east', 'east', 'south-east', 'south', 'south-west', 'west', 'north-west'];
const POINTS_16 = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];

export function compassWord(azDeg: number): string {
  return POINTS_8[Math.round((((azDeg % 360) + 360) % 360) / 45) % 8] ?? 'north';
}

export function compassPoint(azDeg: number): string {
  return POINTS_16[Math.round((((azDeg % 360) + 360) % 360) / 22.5) % 16] ?? 'N';
}

const localTime = new Intl.DateTimeFormat(undefined, { hour: '2-digit', minute: '2-digit' });
const localDay = new Intl.DateTimeFormat(undefined, { weekday: 'short' });
const utcTime = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit', timeZone: 'UTC' });
const utcHm = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'UTC' });

export function formatLocalTime(t: number): string {
  return localTime.format(new Date(t));
}

const localHour = new Intl.DateTimeFormat(undefined, { hour: 'numeric' });

/** "9 PM" / "21" — for axis labels. */
export function formatLocalHour(t: number): string {
  return localHour.format(new Date(t));
}

export function formatLocalDay(t: number): string {
  return localDay.format(new Date(t));
}

export function formatUtc(t: number, seconds = false): string {
  return `${(seconds ? utcTime : utcHm).format(new Date(t))} UTC`;
}

/** "4:07", "1:02:30" — for countdowns. */
export function formatClock(ms: number): string {
  const total = Math.max(0, Math.round(ms / SECOND));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const ss = String(s).padStart(2, '0');
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${ss}` : `${m}:${ss}`;
}

/** "in 3 h 12 min", "in 8 min", "in 0:42". */
export function formatCountdown(ms: number): string {
  if (ms <= 0) return 'now';
  if (ms < 10 * MINUTE) return `in ${formatClock(ms)}`;
  const h = Math.floor(ms / HOUR);
  const m = Math.round((ms % HOUR) / MINUTE);
  return h > 0 ? `in ${h} h ${m} min` : `in ${m} min`;
}

export function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60);
  return m > 0 ? `${m} min ${s ? `${s} s` : ''}`.trim() : `${s} s`;
}
