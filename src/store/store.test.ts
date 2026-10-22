import 'fake-indexeddb/auto';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { saveLocation, locationFromGrid } from '../data/locations';
import { listPlans } from '../data/plans';
import { loadFavorites } from '../data/favorites';
import { saveQso } from '../data/log';
import type { Pass, QsoRecord } from '../model/types';
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

  it('back-fills pass ids on recent contacts once, and leaves old ones unmatched', async () => {
    const now = 1_761_100_800_000;
    const sat = { noradId: 43017, name: 'AO-91' };
    vi.stubGlobal('fetch', () => Promise.resolve(new Response(JSON.stringify({ generatedAt: 1, satellites: [sat] }))));
    const base = { satNoradId: 43017, locationId: 'home', satDisplayName: 'AO-91' };
    await saveQso({ ...base, id: 'recent', call: 'K1ABC', timeOn: now - 60_000 } as QsoRecord);
    await saveQso({ ...base, id: 'old', call: 'K2ABC', timeOn: now - 30 * 86_400_000 } as QsoRecord);
    const s = createStore();
    await s.load();
    await s.loadLog();
    let calls = 0;
    const predict = async () => {
      calls++;
      return [{ noradId: 43017, aos: now - 5 * 60_000, los: now + 5 * 60_000 } as Pass];
    };
    await s.backfillPassIds(predict, now);
    const byId = new Map(s.get().qsos!.map((q) => [q.id, q.passId]));
    expect(byId.get('recent')).toMatch(/^43017-/);
    expect(byId.get('old')).toBeNull();
    await s.backfillPassIds(predict, now);
    expect(calls).toBe(1);
  });
});
