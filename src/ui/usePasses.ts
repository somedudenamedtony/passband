import { useEffect, useState } from 'react';
import { DAY, MINUTE } from '../model/time';
import type { Location, Pass, Satellite } from '../model/types';
import { predictPasses } from '../predict/client';
import { useClock } from './clock';

const REFRESH = 30 * MINUTE;

/** Passes for the next 24 h, recomputed every half hour and whenever inputs change. */
export function usePasses(sats: Satellite[], location: Location) {
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
    const from = clock.now();
    setError(null);
    predictPasses(sats, location, from, from + DAY)
      .then((p) => {
        if (!cancelled) setPasses(p);
      })
      .catch((e: Error) => {
        if (!cancelled) setError(e.message);
      });
    return () => {
      cancelled = true;
    };
  }, [sats, location, clock, tick]);

  return { passes, error };
}
