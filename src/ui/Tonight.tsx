import { useMemo, useState } from 'react';
import type { LoadedCatalog } from '../data/catalog';
import { elementAgeDays, elementAgeLevel } from '../model/elementAge';
import { ACTIVITIES, activities, matchesActivities, type Activity } from '../model/activity';
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
  chosen,
  onChosen,
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
  /** Activity keys pressed under All active; none pressed = no filter. Also kept by App. */
  chosen: ReadonlySet<Activity>;
  onChosen: (a: ReadonlySet<Activity>) => void;
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
  const narrowing = scope !== 'recommended';
  const q = narrowing ? query.trim().toLowerCase() : '';
  const act = narrowing ? chosen : NO_ACTIVITIES;
  const sats = useMemo(() => listedSatellites(catalog.catalog, station.experience, SCOPE_OPTS[scope]), [catalog, station.experience, scope]);
  const satById = useMemo(() => new Map(sats.map((s) => [s.noradId, s])), [sats]);
  const { passes, error } = usePasses(sats, location);

  const upcoming = useMemo(() => (passes ?? []).filter((p) => p.los > now), [passes, now]);
  // Activity keys and search narrow the lists only; passes are predicted once for the whole selection.
  const actCounts = useMemo(() => {
    const m = new Map<Activity, number>();
    for (const sat of sats) for (const a of activities(sat)) m.set(a, (m.get(a) ?? 0) + 1);
    return m;
  }, [sats]);
  const filtered = q !== '' || act.size > 0;
  const shownSats = useMemo(
    () => (filtered ? sats.filter((s) => matchesActivities(s, act) && (!q || s.name.toLowerCase().includes(q))) : sats),
    [sats, filtered, act, q],
  );
  const shownById = useMemo(() => new Map(shownSats.map((s) => [s.noradId, s])), [shownSats]);
  const shownPasses = useMemo(() => (filtered ? upcoming.filter((p) => shownById.has(p.noradId)) : upcoming), [filtered, upcoming, shownById]);
  const listKey = `${scope}:${q}:${[...act].sort().join(',')}`;
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
        {narrowing && (
          <div className="stack" style={{ marginTop: 14 }}>
            <p className="silk">What do you want to do?</p>
            <div className="chips" role="group" aria-label="Activities">
              {ACTIVITIES.filter((a) => actCounts.has(a.id)).map((a) => (
                <button
                  key={a.id}
                  type="button"
                  className="chip"
                  aria-pressed={chosen.has(a.id)}
                  title={a.hint}
                  onClick={() => {
                    const next = new Set(chosen);
                    if (next.has(a.id)) next.delete(a.id);
                    else next.add(a.id);
                    onChosen(next);
                  }}
                >
                  {a.label} <span className="chip-count">{actCounts.get(a.id)}</span>
                </button>
              ))}
            </div>
            <p className="hint">
              {act.size === 0
                ? 'Tap one or more to narrow the list. Most satellites only send telemetry.'
                : ACTIVITIES.filter((a) => act.has(a.id))
                    .map((a) => a.hint)
                    .join(' ')}
            </p>
          </div>
        )}
        {narrowing && (
          <Field
            label="Find a satellite"
            type="search"
            value={query}
            placeholder="AO-91, ISS, SO-50…"
            autoCapitalize="characters"
            autoCorrect="off"
            spellCheck={false}
            onChange={(e) => setQuery(e.target.value)}
          />
        )}
        {filtered && (
          <p className="hint" role="status" style={{ marginTop: 8 }}>
            Showing {shownSats.length} of {sats.length} satellites.{' '}
            <button
              type="button"
              className="linkish"
              onClick={() => {
                setQuery('');
                onChosen(NO_ACTIVITIES);
              }}
            >
              Clear filters
            </button>
          </p>
        )}
      </section>

      {passes && (
        <>
          <PassList key={`list:${listKey}`} passes={shownPasses} sats={shownById} station={station} now={now} selected={featured} onSelect={onSelect} />
          <Timeline
            key={`timeline:${listKey}`}
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

const NO_ACTIVITIES: ReadonlySet<Activity> = new Set();

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
