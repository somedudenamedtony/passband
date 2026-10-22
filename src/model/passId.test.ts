import { describe, expect, it } from 'vitest';
import { parsePassId, passId } from './passId';
import { MINUTE, SECOND } from './time';

describe('pass ids (D23)', () => {
  it('survives AOS moving by seconds after a re-prediction', () => {
    const aos = 1_761_100_800_000;
    expect(passId(25544, aos + 20 * SECOND)).toBe(passId(25544, aos));
    expect(passId(25544, aos - 20 * SECOND)).toBe(passId(25544, aos));
    expect(passId(25544, aos + MINUTE)).not.toBe(passId(25544, aos));
  });

  it('parses its own output and nothing else', () => {
    expect(parsePassId(passId(43017, 1_761_100_800_000))).toEqual({ noradId: 43017, aosMinuteMs: 1_761_100_800_000 });
    expect(parsePassId('43017')).toBeNull();
    expect(parsePassId('x-1')).toBeNull();
  });
});
