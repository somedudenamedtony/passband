// SPEC-v2 D27: one app store over IndexedDB. Screens read state through these hooks and change it
// through these actions; they never call idb or the worker themselves. A synced store could
// replace the data modules underneath without touching a screen (D1).

import { useSyncExternalStore } from 'react';
import { loadCatalog, type LoadedCatalog } from '../data/catalog';
import { getActiveLocationId, listLocations, setActiveLocationId } from '../data/locations';
import { deletePlan, listPlans, savePlan } from '../data/plans';
import { loadStationV2, saveStationV2 } from '../data/stationV2';
import type { PassId } from '../model/passId';
import type { Plan } from '../model/plan';
import type { StationV2 } from '../model/stationV2';
import type { Location } from '../model/types';

export interface AppState {
  status: 'loading' | 'ready';
  /** null while loading, and when there's no copy online or on the device (D4). */
  catalog: LoadedCatalog | null;
  locations: Location[];
  activeLocationId: string | null;
  station: StationV2 | null;
  /** Soonest first. */
  plans: Plan[];
}

const INITIAL: AppState = { status: 'loading', catalog: null, locations: [], activeLocationId: null, station: null, plans: [] };

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
