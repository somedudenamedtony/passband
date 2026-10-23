// SPEC-v2 §6.5: the satellite page. The v1 profile (who built it, what's on board, activity,
// reports) with its next passes, which open on the pass page, and ★ for My satellites.

import { useEffect, useMemo } from 'react';
import { passId } from '../model/passId';
import { toV1Station } from '../model/stationV2';
import { DAY } from '../model/time';
import { navigate } from '../router';
import { usePasses } from '../store/passes';
import { store, useActiveLocation, useAppState } from '../store/store';
import { useNow } from '../ui/clock';
import { SatelliteProfile } from '../ui/SatelliteInfo';
import { Gone } from './PassPage';

export function SatelliteScreen({ noradId }: { noradId: number }) {
  const sat = useAppState((s) => s.catalog?.catalog.satellites.find((x) => x.noradId === noradId) ?? null);
  const station = useAppState((s) => s.station);
  const qsos = useAppState((s) => s.qsos);
  const location = useActiveLocation();
  const now = useNow(30_000);
  const sats = useMemo(() => (sat ? [sat] : []), [sat]);
  const { passes } = usePasses(sats, location, 0, DAY);
  useEffect(() => {
    void store.loadLog();
  }, []);

  if (!sat || !station) return <Gone title="Unknown satellite" text={`NORAD ${noradId} isn’t in the satellite data on this device.`} />;
  if (!location) return <Gone title={sat.name} text="Set where you are on Now to see this satellite’s passes." />;
  return (
    <SatelliteProfile
      sat={sat}
      location={location}
      station={toV1Station(station)}
      now={now}
      passes={(passes ?? []).filter((p) => p.los > now)}
      qsos={qsos ?? []}
      onPick={(p) => navigate({ name: 'pass', passId: passId(p.noradId, p.aos) })}
      favorite={station.mySatellites.includes(noradId)}
      onFavorite={() => void store.toggleMySatellite(noradId)}
    />
  );
}
