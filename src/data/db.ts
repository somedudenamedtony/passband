// D11: all user data in IndexedDB. Small modules (catalog, locations, station) sit on top of
// this so a synced store can replace it later without touching callers (D1).

import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import type { Catalog, Location, QsoRecord, Recording } from '../model/types';

interface PassbandDB extends DBSchema {
  /** Last good catalog (D4). Single row, key 'current'. */
  catalog: { key: string; value: Catalog };
  locations: { key: string; value: Location };
  /** Key-value settings: 'station', 'activeLocationId', 'theme', 'favorites'. */
  settings: { key: string; value: unknown };
  /** D12: the log. */
  qsos: { key: string; value: QsoRecord; indexes: { timeOn: number } };
  /** D13: pass recordings, blobs included. */
  recordings: { key: string; value: Recording; indexes: { startedAt: number } };
}

let dbPromise: Promise<IDBPDatabase<PassbandDB>> | null = null;

export function db(): Promise<IDBPDatabase<PassbandDB>> {
  dbPromise ??= openDB<PassbandDB>('passband', 3, {
    upgrade(d, oldVersion) {
      if (oldVersion < 1) {
        d.createObjectStore('catalog');
        d.createObjectStore('locations', { keyPath: 'id' });
        d.createObjectStore('settings');
      }
      if (oldVersion < 2) {
        d.createObjectStore('qsos', { keyPath: 'id' }).createIndex('timeOn', 'timeOn');
      }
      if (oldVersion < 3) {
        d.createObjectStore('recordings', { keyPath: 'id' }).createIndex('startedAt', 'startedAt');
      }
    },
  });
  return dbPromise;
}
