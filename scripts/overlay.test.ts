import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import tqsl from '../src/test/fixtures/tqsl.json';
import type { OverlayEntry } from './catalog-lib.ts';

const dir = join(import.meta.dirname, '..', 'data', 'overlay');
const entries = readdirSync(dir)
  .filter((f) => f.endsWith('.json'))
  .map((f) => ({ file: f, entry: JSON.parse(readFileSync(join(dir, f), 'utf8')) as OverlayEntry }));

describe('overlay (D6, D12)', () => {
  it('every LoTW name is one TQSL knows, for a satellite that is still current', () => {
    for (const { file, entry } of entries) {
      if (entry.lotwName === null) continue;
      const s = tqsl.satellites.find((x) => x.name === entry.lotwName);
      expect(s, `${file}: ${entry.lotwName}`).toBeDefined();
      expect(s!.ended, `${file}: ${entry.lotwName} has an end date in TQSL`).toBe(false);
    }
  });
  it('every override cites a source', () => {
    for (const { file, entry } of entries) {
      for (const o of entry.transmitterOverrides ?? []) expect(o.source, file).toBeTruthy();
    }
  });
});
