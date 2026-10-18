import type { TrackPoint } from '../model/track';

const R = 100; // horizon radius in SVG units

/** Polar plot: zenith in the centre, horizon at the edge, north up, east to the right. */
function xy(azDeg: number, elDeg: number): [number, number] {
  const r = (R * (90 - Math.max(0, Math.min(90, elDeg)))) / 90;
  const a = (azDeg * Math.PI) / 180;
  return [r * Math.sin(a), -r * Math.cos(a)];
}

export function SkyPlot({
  track,
  now,
  mask,
  headingDeg = null,
}: {
  track: readonly TrackPoint[];
  now: TrackPoint | null;
  mask: readonly number[];
  /** D10: rotate so the way the phone points is up. null = north up. */
  headingDeg?: number | null;
}) {
  const rot = headingDeg === null ? 0 : -headingDeg;
  const path = track
    .filter((_, i) => i % 5 === 0 || i === track.length - 1)
    .map((p, i) => {
      const [x, y] = xy(p.azDeg, p.elDeg);
      return `${i ? 'L' : 'M'}${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');
  const first = track[0];
  const last = track[track.length - 1];
  const hasMask = mask.some((m) => m > 0);
  const maskPath = hasMask
    ? mask
        .flatMap((m, i) => [xy(i * 10, m), xy(i * 10 + 10, m)])
        .map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)},${y.toFixed(1)}`)
        .join(' ') + ' Z'
    : '';
  const up = now && now.elDeg > 0;
  const [nx, ny] = now ? xy(now.azDeg, now.elDeg) : [0, 0];

  return (
    <svg viewBox="-120 -120 240 240" className="mx-auto block aspect-square w-full max-w-[22rem]" role="img" aria-label="Sky plot">
      <circle r={R} fill="var(--surface)" stroke="var(--border)" strokeWidth={1.5} />
      <g transform={`rotate(${rot})`}>
      {hasMask && (
        <path d={`M0,${-R} A${R},${R} 0 1,1 0,${R} A${R},${R} 0 1,1 0,${-R} ${maskPath}`} fill="var(--bar-dim)" fillRule="evenodd" opacity={0.6} />
      )}
      {[30, 60].map((el) => (
        <circle key={el} r={(R * (90 - el)) / 90} fill="none" stroke="var(--border)" strokeWidth={1} />
      ))}
      <line x1={-R} x2={R} y1={0} y2={0} stroke="var(--border)" strokeWidth={1} />
      <line y1={-R} y2={R} x1={0} x2={0} stroke="var(--border)" strokeWidth={1} />
      {(
        [
          ['N', 0, -R - 10],
          ['E', R + 10, 0],
          ['S', 0, R + 10],
          ['W', -R - 10, 0],
        ] as const
      ).map(([l, x, y]) => (
        <text key={l} x={x} y={y} transform={`rotate(${-rot} ${x} ${y})`} textAnchor="middle" dominantBaseline="central" fontSize={14} fontWeight={800} fill="var(--fg)">
          {l}
        </text>
      ))}
      <path d={path} fill="none" stroke="var(--accent)" strokeWidth={4} strokeLinecap="round" strokeLinejoin="round" />
      {first && (
        <circle cx={xy(first.azDeg, first.elDeg)[0]} cy={xy(first.azDeg, first.elDeg)[1]} r={5} fill="var(--bg)" stroke="var(--accent)" strokeWidth={3} />
      )}
      {last && (
        <rect x={xy(last.azDeg, last.elDeg)[0] - 4} y={xy(last.azDeg, last.elDeg)[1] - 4} width={8} height={8} fill="var(--accent)" />
      )}
      {up && (
        <>
          <circle cx={nx} cy={ny} r={11} fill="var(--fg)" opacity={0.25} />
          <circle cx={nx} cy={ny} r={7} fill="var(--fg)" stroke="var(--bg)" strokeWidth={2} />
        </>
      )}
      </g>
      {headingDeg !== null && <path d={`M0,${-R - 2} l-7,-12 l14,0 Z`} fill="var(--accent)" aria-label="You are facing this way" />}
    </svg>
  );
}
