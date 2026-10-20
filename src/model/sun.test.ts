import { sunPos } from 'satellite.js';
import { describe, expect, it } from 'vitest';
import { inEarthShadow } from './sun';

describe('Earth shadow', () => {
  const t = Date.UTC(2026, 9, 20, 12);
  const { rsun } = sunPos(t / 86_400_000 + 2440587.5);
  const n = Math.hypot(rsun.x, rsun.y, rsun.z);
  const toSun = { x: rsun.x / n, y: rsun.y / n, z: rsun.z / n };
  const at = (k: number, v: { x: number; y: number; z: number }) => ({ x: v.x * k, y: v.y * k, z: v.z * k });
  it('is dark directly behind the Earth and lit on the sunward side', () => {
    expect(inEarthShadow(at(-6900, toSun), t)).toBe(true);
    expect(inEarthShadow(at(6900, toSun), t)).toBe(false);
  });
  it('is lit off to the side, beyond the shadow cylinder', () => {
    const side = { x: -toSun.y, y: toSun.x, z: 0 };
    const len = Math.hypot(side.x, side.y);
    expect(inEarthShadow(at(6900 / len, side), t)).toBe(false);
  });
});
