// D10: the compass. Feature-detected, never UA-sniffed:
//  - `deviceorientationabsolute` (Android/Chrome): alpha is relative to magnetic north.
//  - `deviceorientation` with `webkitCompassHeading` (iOS, after a permission tap).
// Magnetic → true with WMM2025 (magvar), then the user's sun-calibration offset.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { magvar } from 'magvar';
import { deviceVectors, normaliseAz, type Pointing } from '../model/orientation';
import { DAY } from '../model/time';
import type { Location, Station } from '../model/types';
import { useClock } from '../ui/clock';

export type CompassStatus = 'unsupported' | 'needs-permission' | 'denied' | 'waiting' | 'ok';

export interface CompassReading {
  /** Top edge of the phone, true north, calibrated. */
  top: Pointing;
  /** Back camera, true north, calibrated. */
  camera: Pointing;
  /** Top edge before the user's calibration offset (true north, declination applied). */
  topUncalibrated: Pointing;
  /** iOS reports accuracy in degrees; elsewhere it's unknown (null). */
  accuracyDeg: number | null;
}

export interface Compass {
  status: CompassStatus;
  reading: CompassReading | null;
  declinationDeg: number;
  /** Must be called from a tap (iOS permission). */
  enable: () => void;
}

interface IosOrientationEvent extends DeviceOrientationEvent {
  webkitCompassHeading?: number;
  webkitCompassAccuracy?: number;
}

type PermissionCtor = { requestPermission?: () => Promise<'granted' | 'denied'> };

function needsPermission(): boolean {
  return typeof DeviceOrientationEvent !== 'undefined' && typeof (DeviceOrientationEvent as unknown as PermissionCtor).requestPermission === 'function';
}

const NO_EVENTS_MS = 3000;

export function useCompass(location: Location, station: Station, active = true): Compass {
  const clock = useClock();
  const supported = typeof window !== 'undefined' && 'DeviceOrientationEvent' in window;
  const [status, setStatus] = useState<CompassStatus>(() =>
    !supported ? 'unsupported' : needsPermission() ? 'needs-permission' : 'waiting',
  );
  const [reading, setReading] = useState<CompassReading | null>(null);
  // Declination changes slowly; recompute per location and per day.
  const day = Math.floor(clock.now() / DAY);
  const declinationDeg = useMemo(
    () => magvar(location.latDeg, location.lonDeg, location.altM / 1000, new Date(day * DAY)),
    [location.latDeg, location.lonDeg, location.altM, day],
  );
  const iosOffset = useRef<number | null>(null);
  const lastEmit = useRef(0);

  const enable = useCallback(() => {
    const ctor = DeviceOrientationEvent as unknown as PermissionCtor;
    if (!ctor.requestPermission) return;
    ctor
      .requestPermission()
      .then((r) => setStatus(r === 'granted' ? 'waiting' : 'denied'))
      .catch(() => setStatus('denied'));
  }, []);

  useEffect(() => {
    if (!active || (status !== 'waiting' && status !== 'ok')) return;
    const absoluteEvent = 'ondeviceorientationabsolute' in window;
    const eventName = absoluteEvent ? 'deviceorientationabsolute' : 'deviceorientation';
    let gotAny = false;

    const onEvent = (raw: Event) => {
      const e = raw as IosOrientationEvent;
      if (e.alpha === null || e.beta === null || e.gamma === null) return;
      let alphaNorth: number;
      let accuracy: number | null = null;
      if (typeof e.webkitCompassHeading === 'number') {
        // iOS: alpha is relative to an arbitrary start; webkitCompassHeading is magnetic. Track the
        // offset between them (heading ≈ 360 − α in both flat and upright holds) and smooth it.
        const off = normaliseAz(360 - e.webkitCompassHeading - e.alpha);
        const prev = iosOffset.current;
        iosOffset.current = prev === null ? off : normaliseAz(prev + 0.2 * (((off - prev + 540) % 360) - 180));
        alphaNorth = normaliseAz(e.alpha + iosOffset.current);
        accuracy = typeof e.webkitCompassAccuracy === 'number' && e.webkitCompassAccuracy >= 0 ? e.webkitCompassAccuracy : null;
      } else if (absoluteEvent || e.absolute) {
        alphaNorth = e.alpha;
      } else {
        return; // relative-only orientation: no use as a compass
      }
      gotAny = true;
      const t = performance.now();
      if (t - lastEmit.current < 100) return;
      lastEmit.current = t;

      // Screen rotation (landscape) turns the frame; correct for it.
      const screenAngle = screen.orientation?.angle ?? 0;
      const v = deviceVectors(alphaNorth - screenAngle, e.beta, e.gamma);
      const toTrue = (p: Pointing, extra: number): Pointing => ({ azDeg: normaliseAz(p.azDeg + declinationDeg + extra), elDeg: p.elDeg });
      setReading({
        top: toTrue(v.top, station.compassOffsetDeg),
        camera: toTrue(v.camera, station.compassOffsetDeg),
        topUncalibrated: toTrue(v.top, 0),
        accuracyDeg: accuracy,
      });
      setStatus('ok');
    };

    window.addEventListener(eventName, onEvent);
    const timer = setTimeout(() => {
      if (!gotAny) setStatus('unsupported');
    }, NO_EVENTS_MS);
    return () => {
      window.removeEventListener(eventName, onEvent);
      clearTimeout(timer);
    };
  }, [active, status, declinationDeg, station.compassOffsetDeg]);

  return { status, reading, declinationDeg, enable };
}
