import { createContext, useContext, useEffect, useState } from 'react';
import { systemClock, type Clock } from '../clock';

// D16: the UI reads time from context so practice mode can swap in a simulated clock.
export const ClockContext = createContext<Clock>(systemClock);

export function useClock(): Clock {
  return useContext(ClockContext);
}

/** Current time from the injected clock, refreshed every `everyMs`. */
export function useNow(everyMs = 1000): number {
  const clock = useClock();
  const [now, setNow] = useState(() => clock.now());
  useEffect(() => {
    setNow(clock.now());
    const id = setInterval(() => setNow(clock.now()), everyMs);
    return () => clearInterval(id);
  }, [clock, everyMs]);
  return now;
}
