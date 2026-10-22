// D22: every screen has a URL under Vite's base, and back is one step. A small router on the
// History API: routes are parsed from the path, pushed with a depth counter in history.state, and
// "up" pops one level, or replaces with the parent when the app was opened on a deep link.

import { useSyncExternalStore } from 'react';
import { parsePassId, type PassId } from './model/passId';

export type Route =
  /** v1, kept reachable until R4 (SPEC-v2 §9). */
  | { name: 'classic' }
  | { name: 'now' }
  | { name: 'plan' }
  | { name: 'log' }
  | { name: 'contact'; qsoId: string }
  | { name: 'pass'; passId: PassId }
  /** practice: run it on a simulated clock (D16). */
  | { name: 'live'; passId: PassId; practice?: true }
  | { name: 'sat'; noradId: number }
  | { name: 'station' }
  /** SPEC-v2 §6.5: search the whole catalog. */
  | { name: 'library' }
  /** SPEC-v2 §6.8: help and the first-contact path. */
  | { name: 'help' }
  | { name: 'notFound'; path: string };

export type Tab = 'now' | 'plan' | 'log';

/** `path` is relative to the base, without a leading slash: "pass/25544-1761100800000". */
export function matchRoute(path: string): Route {
  const [pathPart = '', query = ''] = path.split('#')[0]!.split('?');
  const parts = pathPart.split('/').filter(Boolean).map(decodeURIComponent);
  const [head, a, b] = parts;
  const n = parts.length;
  if (n === 0 || head === 'classic') return { name: 'classic' };
  if (n === 1 && (head === 'now' || head === 'plan' || head === 'log' || head === 'station' || head === 'library' || head === 'help')) return { name: head };
  if (n === 2 && head === 'log') return { name: 'contact', qsoId: a! };
  if (head === 'pass' && a && parsePassId(a)) {
    if (n === 2) return { name: 'pass', passId: a };
    if (n === 3 && b === 'live') return new URLSearchParams(query).has('practice') ? { name: 'live', passId: a, practice: true } : { name: 'live', passId: a };
  }
  if (n === 2 && head === 'sat' && /^\d{1,9}$/.test(a!)) return { name: 'sat', noradId: Number(a) };
  return { name: 'notFound', path };
}

export function routePath(r: Route): string {
  switch (r.name) {
    case 'classic': return 'classic/';
    case 'now': case 'plan': case 'log': case 'station': case 'library': case 'help': return r.name;
    case 'contact': return `log/${encodeURIComponent(r.qsoId)}`;
    case 'pass': return `pass/${r.passId}`;
    case 'live': return `pass/${r.passId}/live${r.practice ? '?practice' : ''}`;
    case 'sat': return `sat/${r.noradId}`;
    case 'notFound': return r.path;
  }
}

/** Which tab is lit on this route. Screens reached from several tabs light none. */
export function tabOf(r: Route): Tab | null {
  switch (r.name) {
    case 'now': case 'plan': case 'log': return r.name;
    case 'contact': return 'log';
    default: return null;
  }
}

/** One level up. Tabs are the top. */
export function parentOf(r: Route): Route | null {
  switch (r.name) {
    case 'live': return { name: 'pass', passId: r.passId };
    case 'contact': return { name: 'log' };
    case 'help': return { name: 'station' };
    case 'pass': case 'sat': case 'station': case 'library': case 'notFound': return { name: 'now' };
    default: return null;
  }
}

// ---- Browser binding ----

const base = import.meta.env.BASE_URL; // D2: '/passband/'

export function href(r: Route): string {
  return base + routePath(r);
}

function currentPath(): string {
  const p = location.pathname;
  return (p.startsWith(base) ? p.slice(base.length) : p.replace(/^\//, '')) + location.search;
}

interface NavState { pbDepth?: number }
const depth = (): number => (history.state as NavState | null)?.pbDepth ?? 0;

const listeners = new Set<() => void>();
function notify() { for (const l of listeners) l(); }
function subscribe(l: () => void) {
  listeners.add(l);
  if (listeners.size === 1) addEventListener('popstate', notify);
  return () => {
    listeners.delete(l);
    if (listeners.size === 0) removeEventListener('popstate', notify);
  };
}

export function navigate(r: Route, opts: { replace?: boolean } = {}): void {
  const url = href(r);
  if (opts.replace) history.replaceState({ pbDepth: depth() } satisfies NavState, '', url);
  else history.pushState({ pbDepth: depth() + 1 } satisfies NavState, '', url);
  notify();
}

/** Back one level: the previous in-app entry if there is one, else the parent (deep link). */
export function goUp(): void {
  const r = matchRoute(currentPath());
  if (depth() > 0) history.back();
  else {
    const parent = parentOf(r);
    if (parent) navigate(parent, { replace: true });
  }
}

export function useRoute(): Route {
  const path = useSyncExternalStore(subscribe, currentPath);
  return matchRoute(path);
}
