// One "back" for the whole app, for the edge swipe: whatever opened last closes first. Sheets,
// dialogs, the live screen and the tab history each register a handler while they can go back.

import { useEffect, useRef } from 'react';

type Handler = () => void;

const stack: Array<{ id: number; run: () => void }> = [];
let nextId = 0;

/** Run the newest handler. False when there's nothing to go back from. */
export function goBack(): boolean {
  const top = stack[stack.length - 1];
  if (!top) return false;
  top.run();
  return true;
}

export function canGoBack(): boolean {
  return stack.length > 0;
}

/** While mounted (and `enabled`), `handler` is what back does. Later registrations win. */
export function useBack(handler: Handler, enabled = true): void {
  const latest = useRef(handler);
  latest.current = handler;
  useEffect(() => {
    if (!enabled) return;
    const id = nextId++;
    stack.push({ id, run: () => latest.current() });
    return () => {
      const i = stack.findIndex((h) => h.id === id);
      if (i >= 0) stack.splice(i, 1);
    };
  }, [enabled]);
}

// ---- The gesture ----

/** A swipe must start this close to the left edge, in CSS px. */
export const EDGE_PX = 24;
/** And travel this far right to count. */
export const TRIGGER_PX = 72;

/**
 * Where an edge swipe has got to: 0 to 1 towards the trigger, or null once it's clearly not a
 * back swipe (started away from the edge, or more vertical than horizontal: a scroll).
 */
export function swipeProgress(start: { x: number; y: number }, now: { x: number; y: number }): number | null {
  if (start.x > EDGE_PX) return null;
  const dx = now.x - start.x;
  const dy = Math.abs(now.y - start.y);
  if (dy > 24 && dy > dx * 0.6) return null;
  return Math.max(0, Math.min(1, dx / TRIGGER_PX));
}
