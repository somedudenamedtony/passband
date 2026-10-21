// Reports per day, as LCD bars: heard is a solid segment, "not heard" an outlined one stacked on
// top, so the two read apart in every finish, the all-red night one included. Tap a day for its
// numbers; a table carries the same data for screen readers.

import { useState } from 'react';

type Day = { day: number; heard: number; notHeard: number };

const W = 320;
const H = 96;
const GAP = 2;

const dayLabel = (t: number) => new Date(t).toLocaleDateString(undefined, { month: 'short', day: 'numeric', timeZone: 'UTC' });

export function ActivityChart({ days }: { days: Day[] }) {
  // Start on the latest day anyone reported: today is often still empty.
  const latest = days.findLastIndex((d) => d.heard + d.notHeard > 0);
  const [picked, setPicked] = useState(latest >= 0 ? latest : days.length - 1);
  const max = Math.max(1, ...days.map((d) => d.heard + d.notHeard));
  const slot = W / days.length;
  const barW = Math.min(18, Math.max(4, slot - 4));
  const y = (n: number) => (n / max) * (H - 4);
  const p = days[picked] ?? days[days.length - 1]!;

  return (
    <figure className="activity">
      <div className="lcd" style={{ padding: '10px 10px 6px' }}>
        <div className="lcd-line lcd-label" style={{ fontSize: 12 }}>
          <span>Reports per day</span>
          <span className="activity-legend" aria-hidden>
            <span className="swatch swatch-heard" /> Heard <span className="swatch swatch-not" /> Not heard
          </span>
        </div>
        <svg viewBox={`0 0 ${W} ${H + 2}`} className="activity-svg" aria-hidden>
          <line x1={0} x2={W} y1={H + 1} y2={H + 1} stroke="var(--lcd-rule)" strokeWidth={1} />
          {days.map((d, i) => {
            const x = i * slot + (slot - barW) / 2;
            const hh = y(d.heard);
            const nh = y(d.notHeard);
            return (
              <g key={d.day} className={i === picked ? 'is-picked' : undefined}>
                {hh > 0 && <rect x={x} y={H - hh} width={barW} height={hh} rx={2} fill="var(--lcd)" />}
                {nh > 0 && (
                  <rect
                    x={x + 0.75}
                    y={H - hh - nh - (hh > 0 ? GAP : 0) + 0.75}
                    width={barW - 1.5}
                    height={Math.max(1, nh - 1.5)}
                    rx={2}
                    fill="none"
                    stroke="var(--lcd)"
                    strokeWidth={1.5}
                  />
                )}
                {/* The hit target is the whole column, wider than the bar. */}
                <rect x={i * slot} y={0} width={slot} height={H + 2} fill="transparent" onClick={() => setPicked(i)} onPointerEnter={() => setPicked(i)} />
              </g>
            );
          })}
        </svg>
        <div className="lcd-line lcd-label" style={{ fontSize: 11 }} aria-hidden>
          <span>{dayLabel(days[0]!.day)}</span>
          <span>{dayLabel(days[days.length - 1]!.day)}</span>
        </div>
        <p className="lcd-note" aria-live="polite" style={{ marginTop: 4 }}>
          {dayLabel(p.day)}: {p.heard} heard, {p.notHeard} not heard
        </p>
      </div>
      <table className="sr-only">
        <caption>AMSAT reports per day</caption>
        <thead>
          <tr>
            <th>Day</th>
            <th>Heard</th>
            <th>Not heard</th>
          </tr>
        </thead>
        <tbody>
          {days.map((d) => (
            <tr key={d.day}>
              <td>{dayLabel(d.day)}</td>
              <td>{d.heard}</td>
              <td>{d.notHeard}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}
