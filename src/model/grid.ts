// D8: Maidenhead locator. Computed to 6 characters; the 4-character square is shown and logged.

export function toGrid6(latDeg: number, lonDeg: number): string {
  const lon = Math.min(Math.max(lonDeg + 180, 0), 360 - 1e-9);
  const lat = Math.min(Math.max(latDeg + 90, 0), 180 - 1e-9);
  const A = 'A'.charCodeAt(0);
  const a = 'a'.charCodeAt(0);
  const f1 = Math.floor(lon / 20);
  const f2 = Math.floor(lat / 10);
  const s1 = Math.floor((lon % 20) / 2);
  const s2 = Math.floor(lat % 10);
  const u1 = Math.floor(((lon % 2) * 60) / 5);
  const u2 = Math.floor(((lat % 1) * 60) / 2.5);
  return (
    String.fromCharCode(A + f1, A + f2) + String(s1) + String(s2) + String.fromCharCode(a + u1, a + u2)
  );
}

export function grid4(grid: string): string {
  return grid.slice(0, 4).toUpperCase();
}

const GRID_RE = /^[A-R]{2}[0-9]{2}([A-X]{2})?$/i;

export function isValidGrid(grid: string): boolean {
  return GRID_RE.test(grid.trim());
}

/** Centre of a 4- or 6-character square. */
export function gridToLatLon(grid: string): { latDeg: number; lonDeg: number } {
  const g = grid.trim();
  if (!GRID_RE.test(g)) throw new Error(`Not a Maidenhead grid: ${grid}`);
  const up = g.toUpperCase();
  const A = 'A'.charCodeAt(0);
  let lon = (up.charCodeAt(0) - A) * 20 - 180 + Number(up[2]) * 2;
  let lat = (up.charCodeAt(1) - A) * 10 - 90 + Number(up[3]);
  if (up.length === 6) {
    lon += ((up.charCodeAt(4) - A) * 5) / 60 + 2.5 / 60;
    lat += ((up.charCodeAt(5) - A) * 2.5) / 60 + 1.25 / 60;
  } else {
    lon += 1;
    lat += 0.5;
  }
  return { latDeg: lat, lonDeg: lon };
}

/** Normalised spelling: "cn87uo" → "CN87uo". */
export function normaliseGrid(grid: string): string {
  const g = grid.trim();
  return g.slice(0, 4).toUpperCase() + g.slice(4).toLowerCase();
}
