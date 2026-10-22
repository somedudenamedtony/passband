// Pass prediction for screens (D27): screens ask these hooks, the hooks ask the worker (D3).

import { useEffect, useMemo, useState } from 'react';
import { passId, type PassId } from '../model/passId';
import { MINUTE } from '../model/time';
import type { TrackPoint } from '../model/track';
import type { Location, Pass, Satellite } from '../model/types';
import { passTrackFor, predictPasses } from '../predict/client';
import { useClock } from '../ui/clock';
import { store, useAppState } from './store';

const REFRESH = 30 * MINUTE;

export interface PassesResult {
  /** null until the first answer. */
  passes: Pass[] | null;
  error: string | null;
}

/** Passes between `fromOffsetMs` and `toOffsetMs` from now, recomputed every half hour. */
export function usePasses(sats: readonly Satellite[], location: Location | null, fromOffsetMs: number, toOffsetMs: number): PassesResult {
  const clock = useClock();
  const [result, setResult] = useState<PassesResult>({ passes: null, error: null });
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), REFRESH);
    return () => clearInterval(id);
  }, []);
  useEffect(() => {
    if (!location || sats.length === 0) {
      setResult({ passes: location ? [] : null, error: null });
      return;
    }
    let cancelled = false;
    const now = clock.now();
    predictPasses([...sats], location, now + fromOffsetMs, now + toOffsetMs)
      .then((passes) => !cancelled && setResult({ passes, error: null }))
      .catch((e: Error) => !cancelled && setResult({ passes: null, error: e.message }));
    return () => {
      cancelled = true;
    };
  }, [sats, location, clock, tick, fromOffsetMs, toOffsetMs]);
  return result;
}

/** One pass by id (D23): re-predicted around its AOS. null when it no longer exists. */
export function usePass(sat: Satellite | null, location: Location | null, id: PassId, aosMinuteMs: number): { pass: Pass | null | undefined; error: string | null } {
  const [result, setResult] = useState<{ pass: Pass | null | undefined; error: string | null }>({ pass: undefined, error: null });
  useEffect(() => {
    if (!sat || !location) return;
    let cancelled = false;
    setResult({ pass: undefined, error: null });
    predictPasses([sat], location, aosMinuteMs - 30 * MINUTE, aosMinuteMs + 30 * MINUTE)
      .then((ps) => !cancelled && setResult({ pass: ps.find((p) => passId(p.noradId, p.aos) === id) ?? null, error: null }))
      .catch((e: Error) => !cancelled && setResult({ pass: null, error: e.message }));
    return () => {
      cancelled = true;
    };
  }, [sat, location, id, aosMinuteMs]);
  return result;
}

export function usePassTrack(sat: Satellite | null, location: Location | null, pass: Pass | null | undefined): TrackPoint[] {
  const [track, setTrack] = useState<TrackPoint[]>([]);
  const key = pass ? `${pass.noradId}-${pass.aos}` : '';
  useEffect(() => {
    if (!sat || !location || !pass) return;
    let cancelled = false;
    void passTrackFor(sat, location, pass).then((t) => !cancelled && setTrack(t));
    return () => {
      cancelled = true;
    };
  }, [sat, location, key]);
  return track;
}

export function useSatelliteMap(sats: readonly Satellite[] | undefined): ReadonlyMap<number, Satellite> {
  return useMemo(() => new Map((sats ?? []).map((s) => [s.noradId, s])), [sats]);
}

/** Matches recent contacts to their passes once the log and catalog are in (SPEC-v2 §5). */
export function useBackfillPassIds(): void {
  const clock = useClock();
  const ready = useAppState((s) => s.qsos !== null && s.catalog !== null);
  useEffect(() => {
    if (ready) void store.backfillPassIds(predictPasses, clock.now());
  }, [ready, clock]);
}
