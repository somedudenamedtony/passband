import { describe, expect, it } from 'vitest';
import { angleDiff, deviceVectors, foldSweep, pointingHint, projectToScreen } from './orientation';
import { sunPosition } from './sun';

describe('device vectors (D10)', () => {
  it('flat on a table, top to the north: top points north, camera at the ground', () => {
    const v = deviceVectors(0, 0, 0);
    expect(v.top.azDeg).toBeCloseTo(0);
    expect(v.top.elDeg).toBeCloseTo(0);
    expect(v.camera.elDeg).toBeCloseTo(-90);
  });
  it('alpha is counter-clockwise: top to the east is alpha 270', () => {
    expect(deviceVectors(270, 0, 0).top.azDeg).toBeCloseTo(90);
    expect(deviceVectors(90, 0, 0).top.azDeg).toBeCloseTo(270);
  });
  it('held upright in portrait, the camera looks at the horizon in the same direction', () => {
    const v = deviceVectors(270, 90, 0);
    expect(v.camera.azDeg).toBeCloseTo(90);
    expect(v.camera.elDeg).toBeCloseTo(0);
    expect(v.top.elDeg).toBeCloseTo(90);
  });
  it('tilting back raises the camera; tilting the top up raises the top', () => {
    expect(deviceVectors(0, 120, 0).camera.elDeg).toBeCloseTo(30);
    expect(deviceVectors(0, 30, 0).top.elDeg).toBeCloseTo(30);
  });
});

describe('pointing', () => {
  it('wraps angle differences through north', () => {
    expect(angleDiff(10, 350)).toBeCloseTo(20);
    expect(angleDiff(350, 10)).toBeCloseTo(-20);
  });
  it('says which way to turn and when you are on target', () => {
    expect(pointingHint({ azDeg: 40, elDeg: 30 }, { azDeg: 5, elDeg: 10 })).toEqual({ turn: 35, raise: 20 });
    expect(pointingHint({ azDeg: 40, elDeg: 30 }, { azDeg: 38, elDeg: 27 })).toBeNull();
  });
  it('projects into the camera view and knows when it is off-screen', () => {
    const p = projectToScreen({ azDeg: 100, elDeg: 10 }, { azDeg: 90, elDeg: 10 }, 60, 80);
    expect(p.x).toBeCloseTo(0.5 + 10 / 60);
    expect(p.y).toBeCloseTo(0.5);
    expect(p.inView).toBe(true);
    expect(projectToScreen({ azDeg: 200, elDeg: 10 }, { azDeg: 90, elDeg: 10 }, 60, 80).inView).toBe(false);
  });
});

describe('horizon sweep (D9)', () => {
  it('takes the highest elevation seen in each touched sector and leaves the rest', () => {
    const base = Array.from({ length: 36 }, () => 3);
    const out = foldSweep(base, [
      { azDeg: 91, elDeg: 12 },
      { azDeg: 95, elDeg: 18.4 },
      { azDeg: 101, elDeg: -5 },
      { azDeg: 359, elDeg: 7 },
    ]);
    expect(out[9]).toBe(18);
    expect(out[10]).toBe(0);
    expect(out[35]).toBe(7);
    expect(out[0]).toBe(3);
  });
});

describe('sun position', () => {
  it('is due south and high at local solar noon near the equinox', () => {
    // 2026-09-23, Greenwich: solar noon is about 11:52 UTC; elevation ≈ 90 − 51.5 ≈ 38.5°.
    const p = sunPosition(Date.UTC(2026, 8, 23, 11, 52), 51.5, 0);
    expect(Math.abs(p.azDeg - 180)).toBeLessThan(2);
    expect(p.elDeg).toBeGreaterThan(37);
    expect(p.elDeg).toBeLessThan(40);
  });
  it('is below the horizon at midnight', () => {
    expect(sunPosition(Date.UTC(2026, 8, 23, 0, 0), 51.5, 0).elDeg).toBeLessThan(0);
  });
});
