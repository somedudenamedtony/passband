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
  it('AMSAT status names match the status page format and cite a source', () => {
    for (const { file, entry } of entries) {
      for (const n of entry.amsatStatusNames ?? []) expect(n, file).toMatch(/^[\w.-]+_\[[\w/.-]+\]$/);
      if (entry.amsatStatusNames?.length) expect(entry.amsatStatusSource, file).toBeTruthy();
    }
  });
  it('an operation is a known value and cites a source', () => {
    for (const { file, entry } of entries) {
      if (entry.operation === undefined) continue;
      expect(['continuous', 'scheduled', 'sunlit'], file).toContain(entry.operation);
      expect(entry.operationSource, file).toBeTruthy();
    }
  });
  it('every profile has a builder, a story and a source', () => {
    for (const { file, entry } of entries) {
      if (!entry.profile) continue;
      expect(entry.profile.builtBy, file).toBeTruthy();
      expect(entry.profile.story, file).toBeTruthy();
      expect(entry.profile.source, file).toMatch(/https?:\/\//);
    }
  });
  it('every override cites a source', () => {
    for (const { file, entry } of entries) {
      for (const o of entry.transmitterOverrides ?? []) expect(o.source, file).toBeTruthy();
    }
  });
});
