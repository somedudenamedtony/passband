import { useMemo, useState } from 'react';
import type { LoadedCatalog } from '../data/catalog';
import { elementAgeDays, elementAgeLevel } from '../model/elementAge';
import { listedSatellites, nextGoodPass, samePass } from '../model/selection';
import type { Location, Pass, Satellite, Station } from '../model/types';
import { Banner, Field, Segmented, SectionTitle } from './common';
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
  scope,
  onScope,
}: {
  catalog: LoadedCatalog;
  location: Location;
  station: Station;
  /** A pass the user picked (here, or from Learn). null = the next good pass. */
  selected: Pass | null;
  onSelect: (p: Pass | null) => void;
  onStart: (pass: Pass, sat: Satellite) => void;
  /** Which satellites the lists cover. Kept by App so it survives switching tabs. */
  scope: SatScope;
  onScope: (s: SatScope) => void;
}) {
  const now = useNow(1000);

  const counts = useMemo(
    () =>
      Object.fromEntries(
        (Object.keys(SCOPE_OPTS) as SatScope[]).map((k) => [k, listedSatellites(catalog.catalog, station.experience, SCOPE_OPTS[k]).length]),
      ) as Record<SatScope, number>,
    [catalog, station.experience],
  );
  const [query, setQuery] = useState('');
  const q = scope === 'recommended' ? '' : query.trim().toLowerCase();
  const sats = useMemo(() => listedSatellites(catalog.catalog, station.experience, SCOPE_OPTS[scope]), [catalog, station.experience, scope]);
  const satById = useMemo(() => new Map(sats.map((s) => [s.noradId, s])), [sats]);
  const { passes, error } = usePasses(sats, location);

  const upcoming = useMemo(() => (passes ?? []).filter((p) => p.los > now), [passes, now]);
  // The search narrows the lists only; passes are predicted once for the whole selection.
  const shownSats = useMemo(() => (q ? sats.filter((s) => s.name.toLowerCase().includes(q)) : sats), [sats, q]);
  const shownById = useMemo(() => new Map(shownSats.map((s) => [s.noradId, s])), [shownSats]);
  const shownPasses = useMemo(() => (q ? upcoming.filter((p) => shownById.has(p.noradId)) : upcoming), [q, upcoming, shownById]);
  const next = useMemo(() => nextGoodPass(upcoming, satById, station.experience, now), [upcoming, satById, station.experience, now]);
  const featured = selected && selected.los > now && satById.has(selected.noradId) ? selected : next;
  const featuredSat = featured ? satById.get(featured.noradId) : undefined;

  const catalogDays = elementAgeDays(catalog.catalog.generatedAt, now);

  return (
    <div className="stack">
      <AgeBanner sats={sats} now={now} />
      {catalogDays >= 3 && (
        <Banner tone="warn">
          Satellite data on this device is {Math.floor(catalogDays)} days old
          {catalog.fromCache ? ' — you’re offline. It will refresh next time you connect.' : '.'}
        </Banner>
      )}

      {error && <Banner tone="danger">Prediction failed: {error}</Banner>}

      {passes === null ? (
        <p className="center muted" style={{ padding: '32px 0' }}>
          Working out passes…
        </p>
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
          {scope === 'recommended' && ' Try All active below.'}
        </Banner>
      )}

      <section aria-label="Satellites">
        <SectionTitle>Satellites</SectionTitle>
        <Segmented
          label="Satellites"
          value={scope}
          onChange={onScope}
          options={[
            { value: 'recommended', label: `Recommended ${counts.recommended}` },
            { value: 'all', label: `All active ${counts.all}` },
            { value: 'inactive', label: `+ Inactive ${counts.inactive}` },
          ]}
        />
        <p className="hint" style={{ marginTop: 6 }}>
          {scope === 'recommended'
            ? station.experience === 'new'
              ? 'Easy FM satellites, and ones you can just listen to.'
              : 'Satellites with a working uplink, and ones you can just listen to.'
            : scope === 'all'
              ? 'Every satellite not known to be dead, including hard and receive-only ones.'
              : 'Everything in the catalog, including satellites reported inactive.'}{' '}
          The lists below follow this.
        </p>
        {scope !== 'recommended' && (
          <Field
            label="Find a satellite"
            type="search"
            value={query}
            placeholder="AO-91, ISS, SO-50…"
            autoCapitalize="characters"
            autoCorrect="off"
            spellCheck={false}
            onChange={(e) => setQuery(e.target.value)}
            hint={q ? `${shownSats.length} match${shownSats.length === 1 ? '' : 'es'}` : undefined}
          />
        )}
      </section>

      {passes && (
        <>
          <PassList key={`list:${scope}:${q}`} passes={shownPasses} sats={shownById} station={station} now={now} selected={featured} onSelect={onSelect} />
          <Timeline
            key={`timeline:${scope}:${q}`}
            passes={shownPasses}
            sats={shownSats}
            station={station}
            now={now}
            selected={featured}
            onSelect={onSelect}
          />
        </>
      )}

    </div>
  );
}

export type SatScope = 'recommended' | 'all' | 'inactive';

const SCOPE_OPTS: Record<SatScope, { showAll: boolean; showInactive: boolean }> = {
  recommended: { showAll: false, showInactive: false },
  all: { showAll: true, showInactive: false },
  inactive: { showAll: true, showInactive: true },
};

/** D5: say when elements are old enough to matter. */
function AgeBanner({ sats, now }: { sats: Satellite[]; now: number }) {
  const aging = sats.filter((s) => elementAgeLevel(s.elementsEpoch, now) === 'aging');
  const stale = sats.filter((s) => elementAgeLevel(s.elementsEpoch, now) === 'stale');
  if (!aging.length && !stale.length) return null;
  const names = (l: Satellite[]) => l.slice(0, 4).map((s) => s.name).join(', ') + (l.length > 4 ? ` and ${l.length - 4} more` : '');
  return (
    <div className="stack">
      {stale.length > 0 && (
        <Banner tone="danger">
          Elements over 14 days old for {names(stale)}. Their pass times are approximate.
        </Banner>
      )}
      {aging.length > 0 && <Banner tone="warn">Elements 3–14 days old for {names(aging)}.</Banner>}
    </div>
  );
}
