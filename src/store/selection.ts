// SPEC-v2 D24: My satellites drives Now and Plan. Until someone stars any, or when they ask for
// Everything workable, the list is every satellite that's on the books and works with their radio.

import { useMemo } from 'react';
import { matchesOperator } from '../model/operator';
import { isUnidentified } from '../model/selection';
import { toV1Station, type StationV2 } from '../model/stationV2';
import type { Satellite } from '../model/types';
import { useAppState } from './store';

export function workable(sat: Satellite, station: StationV2): boolean {
  return sat.status !== 'inactive' && !isUnidentified(sat) && matchesOperator(sat, toV1Station(station));
}

export function shownSatellites(all: readonly Satellite[], station: StationV2): Satellite[] {
  const mine = new Set(station.mySatellites);
  const widen = station.showEverythingWorkable || mine.size === 0;
  return all.filter((s) => mine.has(s.noradId) || (widen && workable(s, station)));
}

export function useShownSatellites(): Satellite[] {
  const all = useAppState((s) => s.catalog?.catalog.satellites);
  const station = useAppState((s) => s.station);
  return useMemo(() => (all && station ? shownSatellites(all, station) : []), [all, station]);
}
