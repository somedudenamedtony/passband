import { describe, expect, it } from 'vitest';
import { formatMHz, formatTone } from './freq';
import { elementAgeLevel } from './elementAge';
import { formatDistance, formatHeight } from './units';
import { compassWord, formatAgo, formatCountdown } from './format';
import { DAY, HOUR, MINUTE, SECOND } from './time';

describe('frequency formatting (D7)', () => {
  it('formats integer Hz as MHz at the edge', () => {
    expect(formatMHz(436_795_000)).toBe('436.795');
    expect(formatMHz(145_800_000)).toBe('145.800');
    expect(formatMHz(145_812_500)).toBe('145.8125');
  });
  it('never renders an unknown tone as blank (D6)', () => {
    expect(formatTone('unknown')).toBe('Tone unknown');
    expect(formatTone(null)).toBe('No tone');
    expect(formatTone(67)).toBe('67.0 Hz');
  });
});

describe('units (D20)', () => {
  it('shows miles by default and km by toggle, from metres', () => {
    expect(formatDistance(1_609_344, 'imperial')).toBe('1,000 mi');
    expect(formatDistance(1_609_344, 'metric')).toBe('1,609 km');
    expect(formatHeight(100, 'imperial')).toBe('328 ft');
  });
});

describe('element age (D5)', () => {
  const now = 100 * DAY;
  it('bands at 3 and 14 days', () => {
    expect(elementAgeLevel(now - 2.9 * DAY, now)).toBe('fresh');
    expect(elementAgeLevel(now - 3 * DAY, now)).toBe('aging');
    expect(elementAgeLevel(now - 14 * DAY, now)).toBe('aging');
    expect(elementAgeLevel(now - 14.1 * DAY, now)).toBe('stale');
  });
});

describe('display', () => {
  it('names directions in words', () => {
    expect(compassWord(225)).toBe('south-west');
    expect(compassWord(359)).toBe('north');
  });
  it('counts down', () => {
    expect(formatCountdown(42_000)).toBe('in 0:42');
    expect(formatCountdown(75 * MINUTE)).toBe('in 1 h 15 min');
  });
});

describe('formatAgo', () => {
  it('reads like a person would say it', () => {
    expect(formatAgo(20 * SECOND)).toBe('just now');
    expect(formatAgo(25 * MINUTE)).toBe('25 min ago');
    expect(formatAgo(3 * HOUR)).toBe('3 h ago');
    expect(formatAgo(3 * DAY)).toBe('3 days ago');
  });
});

describe('formatCountdown', () => {
  it('carries a rounded-up minute into the hour', () => {
    expect(formatCountdown(2 * HOUR + 59 * MINUTE + 40 * SECOND)).toBe('in 3 h 0 min');
    expect(formatCountdown(59 * MINUTE + 50 * SECOND)).toBe('in 1 h 0 min');
    expect(formatCountdown(10 * HOUR + 4 * MINUTE)).toBe('in 10 h 4 min');
  });
});
