// §10 lint checks on src/ (tests and fixtures excluded):
//   D6  — no frequency-like integer (≥ 28 000 000) in source. Frequencies come from the catalog.
//   D16 — no Date.now() / argument-less new Date() outside clock.ts.
//   D2  — no root-absolute asset paths; everything goes through Vite's base.
// A line may opt out of the number rule with `lint-allow-number: <reason>`.

import { readdir, readFile } from 'node:fs/promises';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

export interface Finding {
  file: string;
  line: number;
  rule: 'D6' | 'D16' | 'D2';
  text: string;
}

const FREQ_FLOOR = 28_000_000;

/** Blank out comments and string contents but keep line structure, so findings keep line numbers. */
function stripComments(src: string): string {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '))
    .replace(/(^|[^:])\/\/.*$/gm, (m, p: string) => p + ' '.repeat(m.length - p.length));
}

function numericLiterals(line: string): number[] {
  const out: number[] = [];
  const re = /(?<![\w.])(\d[\d_]*(?:\.\d+)?(?:e[+-]?\d+)?)(?![\w])/gi;
  for (const m of line.matchAll(re)) out.push(Number(m[1]!.replace(/_/g, '')));
  return out;
}

export function checkSource(file: string, src: string): Finding[] {
  const findings: Finding[] = [];
  const rawLines = src.split('\n');
  const lines = stripComments(src).split('\n');
  const isClock = /(^|\/)clock\.ts$/.test(file);
  lines.forEach((line, i) => {
    const raw = rawLines[i] ?? '';
    if (!raw.includes('lint-allow-number:') && numericLiterals(line).some((n) => n >= FREQ_FLOOR)) {
      findings.push({ file, line: i + 1, rule: 'D6', text: raw.trim() });
    }
    if (!isClock && (/\bDate\.now\s*\(/.test(line) || /\bnew\s+Date\s*\(\s*\)/.test(line))) {
      findings.push({ file, line: i + 1, rule: 'D16', text: raw.trim() });
    }
    if (/(?:src|href)=["']\/(?!\/)|fetch\(\s*["'`]\/(?!\/)/.test(line)) {
      findings.push({ file, line: i + 1, rule: 'D2', text: raw.trim() });
    }
  });
  return findings;
}

function excluded(rel: string): boolean {
  return /\.test\.tsx?$/.test(rel) || /(^|\/)(test|fixtures)(\/|$)/.test(rel);
}

async function walk(dir: string): Promise<string[]> {
  const out: string[] = [];
  for (const e of await readdir(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) out.push(...(await walk(p)));
    else if (/\.(ts|tsx)$/.test(e.name)) out.push(p);
  }
  return out;
}

async function main() {
  const root = join(dirname(fileURLToPath(import.meta.url)), '..');
  const src = join(root, 'src');
  const findings: Finding[] = [];
  for (const f of await walk(src)) {
    const rel = relative(root, f).replace(/\\/g, '/');
    if (excluded(relative(src, f).replace(/\\/g, '/'))) continue;
    findings.push(...checkSource(rel, await readFile(f, 'utf8')));
  }
  const why = {
    D6: 'frequency-like number in src/ — frequencies come from the catalog',
    D16: 'reads the system clock — use the injected Clock (clock.ts)',
    D2: 'root-absolute path — use import.meta.env.BASE_URL',
  };
  for (const f of findings) console.error(`${f.file}:${f.line}  [${f.rule}] ${why[f.rule]}\n    ${f.text}`);
  if (findings.length) {
    console.error(`\n${findings.length} problem(s).`);
    process.exit(1);
  }
  console.log('Source checks passed (D2, D6, D16).');
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) void main();
