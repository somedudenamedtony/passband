// §5.3 map geometry. Spherical Earth: plenty for drawing a footprint on a phone.

import { grid4, toGrid6 } from './grid';

const EARTH_R_M = 6_371_000;
const RAD = Math.PI / 180;

/** Angular radius (radians, at Earth's centre) of the area that sees the satellite above 0°. */
export function footprintAngle(altM: number): number {
  return Math.acos(EARTH_R_M / (EARTH_R_M + altM));
}

/** Ground distance (metres) from the sub-satellite point to the footprint edge. */
export function footprintRadiusM(altM: number): number {
  return footprintAngle(altM) * EARTH_R_M;
}

/** Great-circle angle between two points, radians. */
export function centralAngle(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const p1 = lat1 * RAD;
  const p2 = lat2 * RAD;
  const dp = p2 - p1;
  const dl = (lon2 - lon1) * RAD;
  const a = Math.sin(dp / 2) ** 2 + Math.cos(p1) * Math.cos(p2) * Math.sin(dl / 2) ** 2;
  return 2 * Math.asin(Math.min(1, Math.sqrt(a)));
}

/** Points [lat, lon] on a small circle of `angle` radians around (lat, lon). */
export function circle(latDeg: number, lonDeg: number, angle: number, n = 96): Array<[number, number]> {
  const p1 = latDeg * RAD;
  const l1 = lonDeg * RAD;
  const pts: Array<[number, number]> = [];
  for (let i = 0; i <= n; i++) {
    const brg = (2 * Math.PI * i) / n;
    const p2 = Math.asin(Math.sin(p1) * Math.cos(angle) + Math.cos(p1) * Math.sin(angle) * Math.cos(brg));
    const l2 = l1 + Math.atan2(Math.sin(brg) * Math.sin(angle) * Math.cos(p1), Math.cos(angle) - Math.sin(p1) * Math.sin(p2));
    pts.push([p2 / RAD, ((((l2 / RAD + 540) % 360) + 360) % 360) - 180]);
  }
  return pts;
}

/** Split a [lat, lon] polyline wherever it jumps across the antimeridian, so it draws cleanly. */
export function splitAtAntimeridian(pts: ReadonlyArray<[number, number]>): Array<Array<[number, number]>> {
  const out: Array<Array<[number, number]>> = [];
  let cur: Array<[number, number]> = [];
  pts.forEach((p, i) => {
    const prev = pts[i - 1];
    if (prev && Math.abs(p[1] - prev[1]) > 180) {
      out.push(cur);
      cur = [];
    }
    cur.push(p);
  });
  if (cur.length) out.push(cur);
  return out;
}

/**
 * Grids a station here can work through this satellite at some point: two stations share it when
 * they're within two footprint radii of each other (both see it at once, at 0° elevation).
 */
export function reachableGrids(latDeg: number, lonDeg: number, altM: number): string[] {
  const reach = 2 * footprintAngle(altM);
  const grids: string[] = [];
  for (let lat = -89.5; lat < 90; lat += 1) {
    for (let lon = -179; lon < 180; lon += 2) {
      if (centralAngle(latDeg, lonDeg, lat, lon) <= reach) grids.push(grid4(toGrid6(lat, lon)));
    }
  }
  return grids;
}
