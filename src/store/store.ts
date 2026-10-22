// SPEC-v2 D27: one app store over IndexedDB. Screens read state through these hooks and change it
// through these actions; they never call idb or the worker themselves. A synced store could
// replace the data modules underneath without touching a screen (D1).

import { useSyncExternalStore } from 'react';
import { loadCatalog, type LoadedCatalog } from '../data/catalog';
import { deleteLocation, getActiveLocationId, listLocations, saveLocation, setActiveLocationId } from '../data/locations';
import { deleteQso, listQsos, markExported, saveQso, saveQsos } from '../data/log';
import { deleteRecording, listRecordings } from '../data/recordings';
import { deletePlan, listPlans, savePlan } from '../data/plans';
import { loadStationV2, saveStationV2 } from '../data/stationV2';
import type { PassId } from '../model/passId';
import type { Plan } from '../model/plan';
import type { StationV2 } from '../model/stationV2';
import { passFor } from '../model/logGroups';
import { DAY, MINUTE } from '../model/time';
import type { Location, Pass, QsoRecord, Recording, Satellite } from '../model/types';

export interface AppState {
  status: 'loading' | 'ready';
  /** null while loading, and when there's no copy online or on the device (D4). */
  catalog: LoadedCatalog | null;
  locations: Location[];
  activeLocationId: string | null;
  station: StationV2 | null;
  /** Soonest first. */
  plans: Plan[];
  /** The log, newest first; null until something asks for it. */
  qsos: QsoRecord[] | null;
  /** Pass recordings, newest first; null until something asks for them. */
  recordings: Recording[] | null;
}

const INITIAL: AppState = { status: 'loading', catalog: null, locations: [], activeLocationId: null, station: null, plans: [], qsos: null, recordings: null };

/** Older contacts aren't matched to a pass: today's elements no longer place a months-old pass. */
export const BACKFILL_WINDOW = 14 * DAY;

export type Predict = (sats: Satellite[], location: Location, from: number, to: number) => Promise<Pass[]>;

export function createStore() {
  let state = INITIAL;
  const listeners = new Set<() => void>();
  const set = (patch: Partial<AppState>) => {
    state = { ...state, ...patch };
    for (const l of listeners) l();
  };
  let loading: Promise<void> | null = null;

  return {
    get: () => state,
    subscribe(l: () => void) {
      listeners.add(l);
      return () => {
        listeners.delete(l);
      };
    },
    /** Loads once; later calls return the same promise. */
    load(): Promise<void> {
      loading ??= (async () => {
        const [locations, activeLocationId, station, plans] = await Promise.all([listLocations(), getActiveLocationId(), loadStationV2(), listPlans()]);
        set({ locations, activeLocationId: activeLocationId ?? locations[0]?.id ?? null, station, plans });
        // The catalog may wait on the network; the rest of the app needn't.
        set({ catalog: await loadCatalog(), status: 'ready' });
      })();
      return loading;
    },
    async retryCatalog() {
      set({ catalog: await loadCatalog() });
    },
    async setActiveLocation(id: string) {
      await setActiveLocationId(id);
      set({ activeLocationId: id });
    },
    /** Adds or replaces a location; a new one becomes the active one. */
    async saveLocation(loc: Location) {
      const isNew = !state.locations.some((l) => l.id === loc.id);
      set({ locations: [...state.locations.filter((l) => l.id !== loc.id), loc] });
      await saveLocation(loc);
      if (isNew) await this.setActiveLocation(loc.id);
    },
    async deleteLocation(id: string) {
      const locations = state.locations.filter((l) => l.id !== id);
      set({ locations, activeLocationId: state.activeLocationId === id ? (locations[0]?.id ?? null) : state.activeLocationId });
      await deleteLocation(id);
      if (state.activeLocationId) await setActiveLocationId(state.activeLocationId);
    },
    async updateStation(patch: Partial<StationV2>) {
      if (!state.station) return;
      const station = { ...state.station, ...patch };
      set({ station });
      await saveStationV2(station);
    },
    async toggleMySatellite(noradId: number) {
      const mine = state.station?.mySatellites ?? [];
      const next = mine.includes(noradId) ? mine.filter((n) => n !== noradId) : [...mine, noradId].sort((a, b) => a - b);
      await this.updateStation({ mySatellites: next });
    },
    /** Loads the log once; screens that show contacts call it. */
    async loadLog() {
      if (state.qsos === null) set({ qsos: await listQsos() });
    },
    /** Adds or replaces a contact. */
    async logQso(q: QsoRecord) {
      await saveQso(q);
      set({ qsos: await listQsos() });
    },
    async deleteQso(id: string) {
      await deleteQso(id);
      set({ qsos: await listQsos() });
    },
    async importQsos(qs: QsoRecord[]) {
      await saveQsos(qs);
      set({ qsos: await listQsos() });
    },
    async markExported(ids: string[], at: number) {
      await markExported(ids, at);
      set({ qsos: await listQsos() });
    },
    /**
     * SPEC-v2 §5: contacts logged before pass ids existed get one by re-prediction, once. A contact
     * that can't be matched gets null, so it isn't tried again.
     */
    async backfillPassIds(predict: Predict, now: number) {
      const todo = (state.qsos ?? []).filter((q) => q.passId === undefined);
      if (todo.length === 0) return;
      const sats = new Map((state.catalog?.catalog.satellites ?? []).map((x) => [x.noradId, x]));
      const updated: QsoRecord[] = [];
      for (const q of todo) {
        const sat = sats.get(q.satNoradId);
        const loc = state.locations.find((l) => l.id === q.locationId);
        let id: string | null = null;
        if (sat && loc && now - q.timeOn <= BACKFILL_WINDOW) {
          try {
            id = passFor(q, await predict([sat], loc, q.timeOn - 30 * MINUTE, q.timeOn + 30 * MINUTE));
          } catch {
            continue; // the worker failed; try again next time
          }
        }
        updated.push({ ...q, passId: id });
      }
      if (updated.length) await this.importQsos(updated);
    },
    async loadRecordings() {
      if (state.recordings === null) set({ recordings: await listRecordings() });
    },
    async deleteRecording(id: string) {
      await deleteRecording(id);
      set({ recordings: await listRecordings() });
    },
    async savePlan(p: Plan) {
      set({ plans: [...state.plans.filter((x) => x.id !== p.id), p].sort((a, b) => a.aos - b.aos) });
      await savePlan(p);
    },
    async removePlan(id: PassId) {
      set({ plans: state.plans.filter((x) => x.id !== id) });
      await deletePlan(id);
    },
  };
}

export type Store = ReturnType<typeof createStore>;

export const store: Store = createStore();

export function useAppState<T>(select: (s: AppState) => T): T {
  return useSyncExternalStore(store.subscribe, () => select(store.get()));
}

export function useActiveLocation(): Location | null {
  return useAppState((s) => s.locations.find((l) => l.id === s.activeLocationId) ?? null);
}
