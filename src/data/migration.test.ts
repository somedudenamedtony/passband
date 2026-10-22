import 'fake-indexeddb/auto';
import { openDB } from 'idb';
import { describe, expect, it } from 'vitest';
import { db } from './db';
import { listLocations } from './locations';
import { listQsos } from './log';
import { deletePlan, listPlans, savePlan } from './plans';
import { loadStation } from './station';
import { loadStationV2, saveStationV2 } from './stationV2';
import { loadFavorites } from './favorites';

// SPEC-v2 §10: a v3 database opens in v4 with everything intact.
async function seedV3() {
  const d = await openDB('passband', 3, {
    upgrade(u) {
      u.createObjectStore('catalog');
      u.createObjectStore('locations', { keyPath: 'id' });
      u.createObjectStore('settings');
      u.createObjectStore('qsos', { keyPath: 'id' }).createIndex('timeOn', 'timeOn');
      u.createObjectStore('recordings', { keyPath: 'id' }).createIndex('startedAt', 'startedAt');
    },
  });
  await d.put('locations', { id: 'home', name: 'Home', latDeg: 47.6, lonDeg: -122.3, altM: 50, grid6: 'CN87uo', mask: [] });
  await d.put('settings', { callsign: 'W7LIT', experience: 'experienced', showTips: true, cues: { speech: false } }, 'station');
  await d.put('settings', [43017, 25544], 'favorites');
  await d.put('qsos', { id: 'q1', call: 'KA7XYZ', timeOn: 1000, satNoradId: 43017 });
  d.close();
}

describe('schema v3 → v4', () => {
  it('keeps locations, the log, the station and favorites, and adds plans', async () => {
    await seedV3();
    const d = await db();
    expect(d.version).toBe(4);
    expect([...d.objectStoreNames]).toContain('plans');
    expect((await listLocations()).map((l) => l.id)).toEqual(['home']);
    expect((await listQsos()).map((q) => q.call)).toEqual(['KA7XYZ']);
    expect(await loadStation()).toMatchObject({ callsign: 'W7LIT', experience: 'experienced' });

    const v2 = await loadStationV2();
    expect(v2).toMatchObject({ callsign: 'W7LIT', guidance: 'guided', mySatellites: [25544, 43017], remembered: { cues: { speech: false } } });

    // Saving v2 leaves the v1 station alone and shares the starred set with it.
    await saveStationV2({ ...v2, guidance: 'numbers', mySatellites: [25544] });
    expect(await loadStationV2()).toMatchObject({ guidance: 'numbers', mySatellites: [25544] });
    expect(await loadStation()).toMatchObject({ experience: 'experienced', showTips: true });
    expect([...(await loadFavorites())]).toEqual([25544]);

    await savePlan({ id: '43017-120000', noradId: 43017, aos: 120_000, los: 600_000, locationId: 'home', transmitterId: null, note: '', outcome: 'planned', createdAt: 1 });
    await savePlan({ id: '25544-60000', noradId: 25544, aos: 60_000, los: 500_000, locationId: 'home', transmitterId: null, note: '', outcome: 'planned', createdAt: 1 });
    expect((await listPlans()).map((p) => p.noradId)).toEqual([25544, 43017]);
    await deletePlan('25544-60000');
    expect(await listPlans()).toHaveLength(1);
  });
});
