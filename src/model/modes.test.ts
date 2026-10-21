import { describe, expect, it } from 'vitest';
import { modeGuide } from './modes';
import type { Transmitter } from './types';

function tx(kind: Transmitter['kind'], mode: string, opts: { up?: boolean; inverting?: boolean | null } = {}): Transmitter {
  return {
    id: 'x',
    description: '',
    kind,
    uplinkHz: opts.up ? 1 : null,
    uplinkHighHz: null,
    downlinkHz: 1,
    downlinkHighHz: null,
    inverting: opts.inverting ?? null,
    mode,
    ctcssHz: null,
    status: 'active',
  };
}

describe('modeGuide', () => {
  it('tells an FM repeater apart from listen-only modes', () => {
    expect(modeGuide(tx('fm_repeater', 'FM', { up: true }))).toMatchObject({ label: 'FM', twoWay: true });
    expect(modeGuide(tx('beacon', 'CW'))).toMatchObject({ label: 'CW', twoWay: false });
    expect(modeGuide(tx('beacon', 'SSTV'))).toMatchObject({ label: 'SSTV', twoWay: false });
    expect(modeGuide(tx('beacon', 'GMSK USP'))).toMatchObject({ label: 'GMSK', what: 'Digital telemetry' });
  });

  it('explains inversion only on an inverting transponder', () => {
    expect(modeGuide(tx('linear_transponder', 'USB', { up: true, inverting: true })).how).toMatch(/inverting/);
    expect(modeGuide(tx('linear_transponder', 'USB', { up: true, inverting: false })).how).not.toMatch(/It’s inverting/);
  });

  it('says Unknown rather than guessing (D6)', () => {
    expect(modeGuide(tx('other', '')).label).toBe('Unknown');
  });
});
