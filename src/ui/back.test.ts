import { describe, expect, it } from 'vitest';
import { EDGE_PX, TRIGGER_PX, swipeProgress } from './back';

describe('edge swipe', () => {
  const edge = { x: 5, y: 300 };

  it('counts a rightward drag from the edge, up to the trigger', () => {
    expect(swipeProgress(edge, { x: 5 + TRIGGER_PX / 2, y: 305 })).toBeCloseTo(0.5);
    expect(swipeProgress(edge, { x: 5 + TRIGGER_PX * 2, y: 310 })).toBe(1);
  });

  it('ignores drags that start away from the edge', () => {
    expect(swipeProgress({ x: EDGE_PX + 10, y: 300 }, { x: 200, y: 300 })).toBeNull();
  });

  it('gives way to a vertical scroll', () => {
    expect(swipeProgress(edge, { x: 30, y: 400 })).toBeNull();
  });

  it('reads a leftward drag as no progress', () => {
    expect(swipeProgress(edge, { x: 0, y: 300 })).toBe(0);
  });
});
