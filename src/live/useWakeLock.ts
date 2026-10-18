import { useEffect, useState } from 'react';

export type WakeLockState = 'off' | 'held' | 'unsupported' | 'failed';

/**
 * D15: hold the screen on while `active`, re-acquiring when the page becomes visible again
 * (browsers drop the lock on hide). Failure is reported, never swallowed.
 */
export function useWakeLock(active: boolean): WakeLockState {
  const [state, setState] = useState<WakeLockState>('off');

  useEffect(() => {
    if (!active) {
      setState('off');
      return;
    }
    if (!('wakeLock' in navigator)) {
      setState('unsupported');
      return;
    }
    let sentinel: WakeLockSentinel | null = null;
    let cancelled = false;

    const acquire = async () => {
      if (document.visibilityState !== 'visible') return;
      try {
        sentinel = await navigator.wakeLock.request('screen');
        if (cancelled) {
          void sentinel.release();
          return;
        }
        setState('held');
        sentinel.addEventListener('release', () => {
          // Hiding the page releases the lock; that is expected and re-acquired on return.
          if (!cancelled && document.visibilityState === 'visible') setState('failed');
        });
      } catch {
        if (!cancelled) setState('failed');
      }
    };
    const onVisible = () => {
      if (document.visibilityState === 'visible') void acquire();
    };

    void acquire();
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      cancelled = true;
      document.removeEventListener('visibilitychange', onVisible);
      void sentinel?.release();
    };
  }, [active]);

  return state;
}
