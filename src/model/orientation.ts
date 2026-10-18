// D10: device orientation → where the phone is pointing. Pure maths; sensors live in compass/.
//
// W3C DeviceOrientation: earth frame x = east, y = north, z = up; R = Rz(α)·Rx(β)·Ry(γ), with α
// measured counter-clockwise from north when the reading is absolute.

export interface Pointing {
  /** degrees clockwise from north, 0–360 */
  azDeg: number;
  /** degrees above the horizon, −90–90 */
  elDeg: number;
}

const RAD = Math.PI / 180;

function toPointing(x: number, y: number, z: number): Pointing {
  const az = (Math.atan2(x, y) / RAD + 360) % 360;
  const el = Math.asin(Math.max(-1, Math.min(1, z))) / RAD;
  return { azDeg: az, elDeg: el };
}

/**
 * Where the top edge of the phone points (hold it along the antenna boom) and where the back
 * camera looks (AR, horizon sweep). `alphaNorth` must already be relative to north.
 */
export function deviceVectors(alphaNorth: number, beta: number, gamma: number): { top: Pointing; camera: Pointing } {
  const sa = Math.sin(alphaNorth * RAD);
  const ca = Math.cos(alphaNorth * RAD);
  const sb = Math.sin(beta * RAD);
  const cb = Math.cos(beta * RAD);
  const sg = Math.sin(gamma * RAD);
  const cg = Math.cos(gamma * RAD);
  // Device +y (top edge): R·(0,1,0)
  const top = toPointing(-sa * cb, ca * cb, sb);
  // Device −z (out of the back, where the camera looks): −R·(0,0,1)
  const camera = toPointing(-(ca * sg + sa * sb * cg), -(sa * sg - ca * sb * cg), -(cb * cg));
  return { top, camera };
}

/** Signed difference a − b in degrees, in (−180, 180]. */
export function angleDiff(a: number, b: number): number {
  const d = (((a - b) % 360) + 540) % 360 - 180;
  return d === -180 ? 180 : d;
}

export function normaliseAz(deg: number): number {
  return ((deg % 360) + 360) % 360;
}

/** "Turn right 35° · raise 20°" — or null when you're on it. */
export function pointingHint(target: Pointing, device: Pointing, toleranceDeg = 8): { turn: number; raise: number } | null {
  const turn = angleDiff(target.azDeg, device.azDeg);
  const raise = target.elDeg - device.elDeg;
  if (Math.abs(turn) <= toleranceDeg && Math.abs(raise) <= toleranceDeg) return null;
  return { turn, raise };
}

export interface ScreenPoint {
  /** 0–1 across the view, left to right */
  x: number;
  /** 0–1 down the view, top to bottom */
  y: number;
  inView: boolean;
}

/**
 * Where a sky position appears in a camera view looking at `camera`, for a view `hFovDeg` wide
 * and `vFovDeg` tall. A flat (equirectangular) approximation: good enough to say "it's there".
 */
export function projectToScreen(target: Pointing, camera: Pointing, hFovDeg: number, vFovDeg: number): ScreenPoint {
  const dx = angleDiff(target.azDeg, camera.azDeg) * Math.cos(camera.elDeg * RAD);
  const dy = target.elDeg - camera.elDeg;
  const x = 0.5 + dx / hFovDeg;
  const y = 0.5 - dy / vFovDeg;
  return { x, y, inView: x >= 0 && x <= 1 && y >= 0 && y <= 1 };
}

/**
 * D9 sweep mode: fold camera readings taken while panning along a treeline into mask sectors.
 * Each touched sector takes the highest elevation seen in it; untouched sectors keep `base`.
 */
export function foldSweep(base: readonly number[], samples: readonly Pointing[]): number[] {
  const swept = new Map<number, number>();
  for (const s of samples) {
    const i = Math.floor(normaliseAz(s.azDeg) / 10) % 36;
    const el = Math.max(0, Math.min(90, s.elDeg));
    swept.set(i, Math.max(swept.get(i) ?? 0, el));
  }
  return base.map((m, i) => (swept.has(i) ? Math.round(swept.get(i)!) : m));
}
