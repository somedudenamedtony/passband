import 'fake-indexeddb/auto';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { saveLocation, locationFromGrid } from '../data/locations';
import { listPlans } from '../data/plans';
import { loadFavorites } from '../data/favorites';
import { createStore } from './store';

afterEach(() => vi.unstubAllGlobals());

describe('app store (D27)', () => {
  it('loads what is on the device even when the catalog is unreachable', async () => {
    vi.stubGlobal('fetch', () => Promise.reject(new Error('offline')));
    await saveLocation({ ...locationFromGrid('Home', 'CN87uo'), id: 'home' });
    const s = createStore();
    let changes = 0;
    s.subscribe(() => changes++);
    await s.load();
    expect(s.get()).toMatchObject({ status: 'ready', catalog: null, activeLocationId: 'home', plans: [] });
    expect(s.get().station?.goal).toBe('contacts');
    expect(changes).toBeGreaterThan(0);
    expect(s.load()).toBe(s.load());
  });

  it('writes through: stars and plans reach IndexedDB', async () => {
    vi.stubGlobal('fetch', () => Promise.reject(new Error('offline')));
    const s = createStore();
    await s.load();
    await s.toggleMySatellite(43017);
    await s.toggleMySatellite(25544);
    await s.toggleMySatellite(43017);
    expect(s.get().station?.mySatellites).toEqual([25544]);
    expect([...(await loadFavorites())]).toEqual([25544]);
    await s.savePlan({ id: '25544-60000', noradId: 25544, aos: 60_000, los: 500_000, locationId: 'home', transmitterId: null, note: '', outcome: 'planned', createdAt: 1 });
    expect((await listPlans()).map((p) => p.id)).toEqual(['25544-60000']);
    await s.removePlan('25544-60000');
    expect(s.get().plans).toEqual([]);
  });
});
