import { describe, expect, it } from 'vitest';
import { groupLog, passFor } from './logGroups';
import { HOUR, MINUTE } from './time';
import type { Pass, QsoRecord } from './types';

const T0 = new Date(2026, 9, 21, 20, 0).getTime();
const q = (id: string, timeOn: number, passId: string | null = null, satNoradId = 43017): QsoRecord =>
  ({ id, call: id, timeOn, satNoradId, satDisplayName: 'AO-91', passId }) as QsoRecord;

describe('log by pass (SPEC-v2 §6.6)', () => {
  it('puts contacts under their pass, the rest under their day, newest first', () => {
    const groups = groupLog([
      q('c', T0 + 2 * HOUR, '43017-1'),
      q('b', T0 + 2 * HOUR - MINUTE, '43017-1'),
      q('a', T0 + HOUR),
      q('z', T0 - 26 * HOUR),
    ]);
    expect(groups.map((g) => (g.kind === 'pass' ? g.passId : g.kind))).toEqual(['43017-1', 'day', 'day']);
    expect(groups[0]!.qsos.map((x) => x.id)).toEqual(['c', 'b']);
  });

  it('finds the pass a contact was made on, allowing for a slow clock', () => {
    const pass = { noradId: 43017, aos: T0, los: T0 + 10 * MINUTE } as Pass;
    expect(passFor(q('a', T0 + 5 * MINUTE), [pass])).toMatch(/^43017-/);
    expect(passFor(q('a', T0 + 11 * MINUTE), [pass])).toMatch(/^43017-/);
    expect(passFor(q('a', T0 + 20 * MINUTE), [pass])).toBeNull();
    expect(passFor(q('a', T0 + 5 * MINUTE, null, 25544), [pass])).toBeNull();
  });
});
