import { useMemo, useState } from 'react';
import type { LoadedCatalog } from '../data/catalog';
import { elementAgeDays, elementAgeLevel } from '../model/elementAge';
import { listedSatellites, nextGoodPass, samePass } from '../model/selection';
import type { Location, Pass, Satellite, Station } from '../model/types';
import { Banner } from './common';
import { useNow } from './clock';
import { PassCard } from './PassCard';
import { PassList } from './PassList';
import { Timeline } from './Timeline';
import { usePasses } from './usePasses';

export function Tonight({
  catalog,
  location,
  station,
  selected,
  onSelect,
  onStart,
}: {
  catalog: LoadedCatalog;
  location: Location;
  station: Station;
  /** A pass the user picked (here, or from Learn). null = the next good pass. */
  selected: Pass | null;
  onSelect: (p: Pass | null) => void;
  onStart: (pass: Pass, sat: Satellite) => void;
}) {
  const now = useNow(1000);
  const [showAll, setShowAll] = useState(false);
  const [showInactive, setShowInactive] = useState(false);

  const sats = useMemo(
    () => listedSatellites(catalog.catalog, station.experience, { showAll, showInactive }),
    [catalog, station.experience, showAll, showInactive],
  );
  const satById = useMemo(() => new Map(sats.map((s) => [s.noradId, s])), [sats]);
  const { passes, error } = usePasses(sats, location);

  const upcoming = useMemo(() => (passes ?? []).filter((p) => p.los > now), [passes, now]);
  const next = useMemo(() => nextGoodPass(upcoming, satById, station.experience, now), [upcoming, satById, station.experience, now]);
  const featured = selected && selected.los > now && satById.has(selected.noradId) ? selected : next;
  const featuredSat = featured ? satById.get(featured.noradId) : undefined;

  const catalogDays = elementAgeDays(catalog.catalog.generatedAt, now);

  return (
    <div className="space-y-4">
      <AgeBanner sats={sats} now={now} />
      {catalogDays >= 3 && (
        <Banner tone="warn">
          Satellite data on this device is {Math.floor(catalogDays)} days old
          {catalog.fromCache ? ' — you’re offline. It will refresh next time you connect.' : '.'}
        </Banner>
      )}

      {error && <Banner tone="danger">Prediction failed: {error}</Banner>}

      {passes === null ? (
        <p className="py-8 text-center text-muted">Working out passes…</p>
      ) : featured && featuredSat ? (
        <PassCard
          pass={featured}
          sat={featuredSat}
          location={location}
          station={station}
          now={now}
          isNext={next !== null && samePass(featured, next)}
          onBackToNext={selected ? () => onSelect(null) : undefined}
          onStart={() => onStart(featured, featuredSat)}
        />
      ) : (
        <Banner tone="info">
          No good passes in the next 24 hours for these satellites from {location.name}.
          {!showAll && ' Try showing all satellites below.'}
        </Banner>
      )}

      {passes && (
        <>
          <PassList passes={upcoming} sats={satById} station={station} now={now} selected={featured} onSelect={onSelect} />
          <Timeline
            passes={upcoming}
            sats={sats}
            station={station}
            now={now}
            selected={featured}
            onSelect={onSelect}
          />
        </>
      )}

      <div className="flex flex-wrap gap-4 text-sm">
        <label className="flex min-h-12 items-center gap-2">
          <input type="checkbox" className="size-5" checked={showAll} onChange={(e) => setShowAll(e.target.checked)} />
          Show all satellites
        </label>
        <label className="flex min-h-12 items-center gap-2">
          <input
            type="checkbox"
            className="size-5"
            checked={showInactive}
            onChange={(e) => setShowInactive(e.target.checked)}
          />
          Include inactive
        </label>
      </div>
      <p className="text-xs text-muted">
        {sats.length} satellites · {station.experience === 'new' ? 'easy FM satellites and listening targets' : 'all with a working uplink'}
        {showAll && ' · showing all'}
      </p>
    </div>
  );
}

/** D5: say when elements are old enough to matter. */
function AgeBanner({ sats, now }: { sats: Satellite[]; now: number }) {
  const aging = sats.filter((s) => elementAgeLevel(s.elementsEpoch, now) === 'aging');
  const stale = sats.filter((s) => elementAgeLevel(s.elementsEpoch, now) === 'stale');
  if (!aging.length && !stale.length) return null;
  const names = (l: Satellite[]) => l.slice(0, 4).map((s) => s.name).join(', ') + (l.length > 4 ? ` and ${l.length - 4} more` : '');
  return (
    <div className="space-y-2">
      {stale.length > 0 && (
        <Banner tone="danger">
          Elements over 14 days old for {names(stale)}. Their pass times are approximate.
        </Banner>
      )}
      {aging.length > 0 && <Banner tone="warn">Elements 3–14 days old for {names(aging)}.</Banner>}
    </div>
  );
}
