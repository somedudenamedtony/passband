// Swipe in from the left edge to go back, the way a native app does. Only when Passband runs as
// an installed app: in a browser tab, Safari's own edge swipe already navigates and the two would
// fight. Detected from the display mode, never the user agent (CLAUDE.md #6).

import { useEffect, useState } from 'react';
import { canGoBack, goBack, swipeProgress } from './back';
import { Icon } from './icons';

function isInstalled(): boolean {
  const standalone = typeof matchMedia === 'function' && matchMedia('(display-mode: standalone)').matches;
  // iOS reports home-screen apps through this non-standard flag as well.
  return standalone || (navigator as Navigator & { standalone?: boolean }).standalone === true;
}

export function EdgeSwipe() {
  const [progress, setProgress] = useState<number | null>(null);

  useEffect(() => {
    if (!isInstalled()) return;
    let start: { x: number; y: number } | null = null;
    let p: number | null = null;

    const onStart = (e: TouchEvent) => {
      const t = e.touches[0];
      start = e.touches.length === 1 && t && canGoBack() ? { x: t.clientX, y: t.clientY } : null;
      p = null;
      if (start && swipeProgress(start, start) === null) start = null;
    };
    const onMove = (e: TouchEvent) => {
      const t = e.touches[0];
      if (!start || !t) return;
      p = swipeProgress(start, { x: t.clientX, y: t.clientY });
      if (p === null) start = null;
      setProgress(p);
    };
    const onEnd = () => {
      if (start && p === 1) goBack();
      start = null;
      p = null;
      setProgress(null);
    };

    document.addEventListener('touchstart', onStart, { passive: true });
    document.addEventListener('touchmove', onMove, { passive: true });
    document.addEventListener('touchend', onEnd);
    document.addEventListener('touchcancel', onEnd);
    return () => {
      document.removeEventListener('touchstart', onStart);
      document.removeEventListener('touchmove', onMove);
      document.removeEventListener('touchend', onEnd);
      document.removeEventListener('touchcancel', onEnd);
    };
  }, []);

  if (progress === null || progress === 0) return null;
  return (
    <div
      className={`edge-back${progress === 1 ? ' is-armed' : ''}`}
      style={{ transform: `translate(${-48 + progress * 64}px, -50%)`, opacity: Math.min(1, progress * 1.5) }}
      aria-hidden
    >
      <Icon name="chevronLeft" />
    </div>
  );
}
