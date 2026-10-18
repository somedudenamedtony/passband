// A pass sampled once a second: everything the live screen needs, computed once up front so the
// screen (and practice mode, D16) only interpolates against whatever the Clock says.

export interface TrackPoint {
  t: number;
  azDeg: number;
  elDeg: number;
  /** metres */
  rangeM: number;
  /** m/s, positive when moving away (D7) */
  rangeRateMps: number;
}

function lerp(a: number, b: number, f: number): number {
  return a + (b - a) * f;
}

/** Azimuth interpolation that goes the short way round through north. */
function lerpAz(a: number, b: number, f: number): number {
  let d = b - a;
  if (d > 180) d -= 360;
  if (d < -180) d += 360;
  return (((a + d * f) % 360) + 360) % 360;
}

/** The track at time t, interpolated; clamped to the first/last point outside the pass. */
export function sampleAt(track: readonly TrackPoint[], t: number): TrackPoint | null {
  if (!track.length) return null;
  const first = track[0]!;
  const last = track[track.length - 1]!;
  if (t <= first.t) return { ...first, t };
  if (t >= last.t) return { ...last, t };
  // Points are evenly spaced, so index directly.
  const step = (last.t - first.t) / (track.length - 1);
  const i = Math.min(track.length - 2, Math.floor((t - first.t) / step));
  const a = track[i]!;
  const b = track[i + 1]!;
  const f = (t - a.t) / (b.t - a.t);
  return {
    t,
    azDeg: lerpAz(a.azDeg, b.azDeg, f),
    elDeg: lerp(a.elDeg, b.elDeg, f),
    rangeM: lerp(a.rangeM, b.rangeM, f),
    rangeRateMps: lerp(a.rangeRateMps, b.rangeRateMps, f),
  };
}
