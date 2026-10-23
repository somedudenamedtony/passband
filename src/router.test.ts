import { describe, expect, it } from 'vitest';
import { matchRoute, parentOf, routePath, tabOf, type Route } from './router';
import { passId } from './model/passId';

const pid = passId(25544, 1_761_100_800_000);

describe('routes (D22)', () => {
  it('round-trips every screen through its path', () => {
    const routes: Route[] = [
      { name: 'now' }, { name: 'plan' }, { name: 'log' }, { name: 'station' }, { name: 'library' }, { name: 'help' },
      { name: 'contact', qsoId: 'abc-123' }, { name: 'pass', passId: pid }, { name: 'live', passId: pid }, { name: 'live', passId: pid, practice: true },
      { name: 'sat', noradId: 25544 },
    ];
    for (const r of routes) expect(matchRoute(routePath(r))).toEqual(r);
  });

  it('opens Now at the root, and on old v1 bookmarks', () => {
    expect(matchRoute('')).toEqual({ name: 'now' });
    expect(matchRoute('classic/')).toEqual({ name: 'now' });
    expect(matchRoute('?utm=1')).toEqual({ name: 'now' });
  });

  it('refuses malformed ids rather than guessing', () => {
    expect(matchRoute('pass/25544').name).toBe('notFound');
    expect(matchRoute('pass/25544-1761100800001').name).toBe('notFound'); // not on a minute
    expect(matchRoute('sat/ISS').name).toBe('notFound');
    expect(matchRoute('now/extra').name).toBe('notFound');
  });

  it('goes up one level at a time and stops at the tabs', () => {
    expect(parentOf({ name: 'live', passId: pid })).toEqual({ name: 'pass', passId: pid });
    expect(parentOf({ name: 'pass', passId: pid })).toEqual({ name: 'now' });
    expect(parentOf({ name: 'contact', qsoId: 'x' })).toEqual({ name: 'log' });
    expect(parentOf({ name: 'plan' })).toBeNull();
    expect(parentOf({ name: 'help' })).toEqual({ name: 'station' });
    expect(tabOf({ name: 'contact', qsoId: 'x' })).toBe('log');
    expect(tabOf({ name: 'pass', passId: pid })).toBeNull();
  });
});
