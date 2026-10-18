import { useEffect, useState } from 'react';
import { DAY, MINUTE } from '../model/time';
import type { Location, Pass, Satellite } from '../model/types';
import { predictPasses } from '../predict/client';
import { useClock } from './clock';

const REFRESH = 30 * MINUTE;

/**
 * Passes from `beforeMs` ago to 24 h ahead, recomputed every half hour and whenever inputs change.
 * Tonight looks forward only; practice (D16) also offers passes that already happened.
 */
export function usePasses(sats: Satellite[], location: Location, beforeMs = 0) {
  const clock = useClock();
  const [passes, setPasses] = useState<Pass[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), REFRESH);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    let cancelled = false;
    const now = clock.now();
    const from = now - beforeMs;
    setError(null);
    predictPasses(sats, location, from, now + DAY)
      .then((p) => {
        if (!cancelled) setPasses(p);
      })
      .catch((e: Error) => {
        if (!cancelled) setError(e.message);
      });
    return () => {
      cancelled = true;
    };
  }, [sats, location, clock, tick, beforeMs]);

  return { passes, error };
}
