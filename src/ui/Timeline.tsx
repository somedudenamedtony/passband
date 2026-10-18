import { isGoodPass, samePass } from '../model/selection';
import { useState } from 'react';
import { Button, SectionTitle } from './common';
import { PAGE } from './PassList';
import { formatLocalHour, formatLocalTime } from '../model/format';
import { DAY, HOUR } from '../model/time';
import type { Pass, Satellite, Station } from '../model/types';

const ROW_H = 28;

/**
 * §5.1: 24 h, one row per satellite, bar height = max elevation. Bars are dimmed where the pass
 * mostly hides behind the horizon mask (D9), or isn't worth working.
 */
export function Timeline({
  passes,
  sats,
  station,
  now,
  selected,
  onSelect,
}: {
  passes: Pass[];
  sats: Satellite[];
  station: Station;
  now: number;
  selected: Pass | null;
  onSelect: (p: Pass) => void;
}) {
  const byId = new Map<number, Pass[]>();
  for (const p of passes) {
    if (p.aos > now + DAY) continue;
    const l = byId.get(p.noradId) ?? [];
    l.push(p);
    byId.set(p.noradId, l);
  }
  const [expanded, setExpanded] = useState(false);
  // Soonest first, so the rows that matter tonight are on screen without scrolling. The selected
  // pass's satellite always keeps its row.
  const first = (id: number) => byId.get(id)?.[0]?.aos ?? Infinity;
  const withPasses = sats.filter((s) => byId.has(s.noradId)).sort((a, b) => first(a.noradId) - first(b.noradId));
  const rows = expanded
    ? withPasses
    : withPasses.filter((s, i) => i < PAGE || (selected !== null && s.noradId === selected.noradId));
  if (!rows.length) return null;

  const x = (t: number) => ((t - now) / DAY) * 1000;
  const firstHour = Math.ceil(now / HOUR) * HOUR;
  const ticks: number[] = [];
  for (let t = firstHour; t < now + DAY; t += 3 * HOUR) ticks.push(t);

  return (
    <section aria-label="24-hour timeline">
      <SectionTitle>Next 24 hours</SectionTitle>
      <div className="panel" style={{ padding: 8 }}>
      <div className="lcd" style={{ padding: 8 }}>
        <div className="tabular timeline-label">
          {ticks.filter((_, i) => i % 2 === 0).map((t) => (
            <span key={t} style={{ left: `${(x(t) / 1000) * 100}%` }}>
              {formatLocalHour(t)}
            </span>
          ))}
        </div>
        {rows.map((s) => (
          <div key={s.noradId} style={{ borderTop: '1px solid var(--border)', padding: '4px 0' }}>
            <div style={{ fontSize: '0.8rem' }}>
              {s.name}
              {s.status === 'unknown' && <span className="muted"> · status unknown</span>}
              {s.status === 'inactive' && <span className="muted"> · inactive</span>}
            </div>
            <svg viewBox={`0 0 1000 ${ROW_H}`} preserveAspectRatio="none" style={{ display: 'block', width: '100%' }} height={ROW_H}>
              {ticks.map((t) => (
                <line key={t} x1={x(t)} x2={x(t)} y1={0} y2={ROW_H} stroke="var(--border)" strokeWidth={1} />
              ))}
              {(byId.get(s.noradId) ?? []).map((p) => {
                const h = Math.max(3, (p.maxElDeg / 90) * ROW_H);
                const x0 = Math.max(0, x(p.aos));
                const w = Math.max(5, x(p.los) - x0);
                const visibleFrac = p.visibleSecondsAboveMask / Math.max(1, (p.los - p.aos) / 1000);
                const dim = visibleFrac < 0.5 || !isGoodPass(p, station.experience);
                const sel = samePass(p, selected);
                return (
                  <rect
                    key={p.aos}
                    x={x0}
                    y={ROW_H - h}
                    width={w}
                    height={h}
                    fill={dim ? 'var(--bar-dim)' : 'var(--bar)'}
                    stroke={sel ? 'var(--fg)' : 'none'}
                    strokeWidth={sel ? 3 : 0}
                    style={{ cursor: 'pointer' }}
                    onClick={() => onSelect(p)}
                  >
                    <title>
                      {`${s.name} ${formatLocalTime(p.aos)}, max ${Math.round(p.maxElDeg)}°`}
                    </title>
                  </rect>
                );
              })}
            </svg>
          </div>
        ))}
      </div>
      </div>
      {withPasses.length > PAGE && (
        <Button kind="ghost" onClick={() => setExpanded((e) => !e)}>
          {expanded ? `Show the first ${PAGE}` : `Show all ${withPasses.length} satellites`}
        </Button>
      )}
    </section>
  );
}
