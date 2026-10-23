// SPEC-v2 §6.5: the catalog, seen only through a search. Empty, it shows My satellites and the ones
// suggested for your radio; typing searches every satellite by name, alias, NORAD id or mode.

import { useMemo, useState } from 'react';
import { Link } from '../app/Link';
import { ModeChip } from '../components/pass';
import { modeGuide } from '../model/modes';
import { operatingTransmitter } from '../model/operator';
import { liveness, amsatMode } from '../model/outlook';
import { toV1Station, type StationV2 } from '../model/stationV2';
import type { Satellite } from '../model/types';
import { workable } from '../store/selection';
import { store, useAppState } from '../store/store';
import { Field } from '../ui/common';
import { Icon } from '../ui/icons';

const LIMIT = 50;

export function searchCatalog(sats: readonly Satellite[], query: string, station: StationV2): Satellite[] {
  const q = query.trim().toLowerCase();
  const v1 = toV1Station(station);
  return sats.filter((s) => {
    if (s.name.toLowerCase().includes(q) || String(s.noradId) === q) return true;
    if (s.about?.alsoKnownAs.some((a) => a.toLowerCase().includes(q))) return true;
    const tx = operatingTransmitter(s, v1);
    return tx !== null && modeGuide(tx).label.toLowerCase() === q;
  });
}

export function LibraryScreen() {
  const sats = useAppState((s) => s.catalog?.catalog.satellites);
  const station = useAppState((s) => s.station);
  const [query, setQuery] = useState('');
  const mine = useMemo(() => new Set(station?.mySatellites ?? []), [station]);
  if (!sats || !station) return <h1 className="screen-title">Satellites</h1>;

  const searching = query.trim() !== '';
  const results = searching ? searchCatalog(sats, query, station) : [];
  const yours = sats.filter((s) => mine.has(s.noradId));
  const suggested = searching ? [] : sats.filter((s) => !mine.has(s.noradId) && workable(s, station) && liveness(s, amsatMode(s)).state === 'heard');

  return (
    <div className="stack">
      <h1 className="screen-title">Satellites</h1>
      <Field
        label="Find a satellite"
        type="search"
        placeholder="Name, NORAD id or mode"
        value={query}
        autoFocus
        onChange={(e) => setQuery(e.target.value)}
      />
      {searching ? (
        <SatList title={`${results.length} found`} sats={results.slice(0, LIMIT)} station={station} mine={mine} more={Math.max(0, results.length - LIMIT)} />
      ) : (
        <>
          <SatList title="My satellites" sats={yours} station={station} mine={mine} empty="None starred yet. Star a satellite here or a pass on Now." />
          <SatList title="Suggested for your radio" sats={suggested} station={station} mine={mine} empty="Nothing heard lately that suits your radio." />
        </>
      )}
    </div>
  );
}

function SatList({ title, sats, station, mine, empty, more = 0 }: { title: string; sats: Satellite[]; station: StationV2; mine: Set<number>; empty?: string; more?: number }) {
  const v1 = toV1Station(station);
  return (
    <section className="stack" aria-label={title}>
      <h2 className="pass-group-title">{title}</h2>
      {sats.length === 0 && empty && <p className="muted">{empty}</p>}
      <ul className="pass-rows">
        {sats.map((s) => {
          const tx = operatingTransmitter(s, v1);
          return (
            <li key={s.noradId} className="pass-row">
              <Link to={{ name: 'sat', noradId: s.noradId }} className="sat-row-link">
                <span className="pr-name">{s.name}</span>
                <ModeChip guide={tx ? modeGuide(tx) : null} />
                <span className="muted sat-row-status">{s.status === 'inactive' ? 'inactive' : s.status === 'active' ? '' : 'status Unknown'}</span>
              </Link>
              <button
                type="button"
                className="pr-plan"
                aria-pressed={mine.has(s.noradId)}
                aria-label={`My satellites: ${s.name}`}
                onClick={() => void store.toggleMySatellite(s.noradId)}
              >
                <Icon name="star" size={18} filled={mine.has(s.noradId)} />
              </button>
            </li>
          );
        })}
      </ul>
      {more > 0 && <p className="muted">{more} more: keep typing to narrow it down.</p>}
    </section>
  );
}
