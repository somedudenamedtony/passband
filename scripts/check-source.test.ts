import { describe, expect, it } from 'vitest';
import { checkSource } from './check-source.ts';

describe('source lint (§10)', () => {
  it('flags frequency-like integers in any spelling', () => {
    for (const lit of ['436795000', '436_795_000', '4.368e8', '145.8e6']) {
      expect(checkSource('src/x.ts', `const f = ${lit};`).map((f) => f.rule)).toEqual(['D6']);
    }
  });
  it('ignores small numbers, comments, and opted-out lines', () => {
    expect(checkSource('src/x.ts', 'const step = 5000; // 436795000 in a comment')).toEqual([]);
    expect(checkSource('src/x.ts', 'const c = 299_792_458; // lint-allow-number: speed of light')).toEqual([]);
  });
  it('flags reading the system clock outside clock.ts', () => {
    expect(checkSource('src/a.ts', 'const t = Date.now();')[0]?.rule).toBe('D16');
    expect(checkSource('src/a.ts', 'const d = new Date();')[0]?.rule).toBe('D16');
    expect(checkSource('src/a.ts', 'const d = new Date(t);')).toEqual([]);
    expect(checkSource('src/clock.ts', 'now: () => Date.now(),')).toEqual([]);
  });
  it('flags root-absolute paths', () => {
    expect(checkSource('src/a.tsx', 'fetch("/catalog.json")')[0]?.rule).toBe('D2');
    expect(checkSource('src/a.tsx', 'fetch(`${import.meta.env.BASE_URL}catalog.json`)')).toEqual([]);
  });
});
