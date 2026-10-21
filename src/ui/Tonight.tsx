import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { LoadedCatalog } from '../data/catalog';
import { elementAgeDays, elementAgeLevel } from '../model/elementAge';
import { ACTIVITIES, activities, matchesActivities, type Activity } from '../model/activity';
import { inHours, isGoodPass, listedSatellites, nextGoodPass, samePass, type ListOptions } from '../model/selection';
import type { Location, Pass, QsoRecord, Satellite, Station } from '../model/types';
import { Banner, Field, Fold, Segmented, SectionTitle } from './common';
import { matchesOperator } from '../model/operator';
import type { SatScope } from '../data/browsing';
import { OperatingPreferences } from './OperatingPreferences';
import { useNow } from './clock';
import { PassCard } from './PassCard';
import { SatelliteInfo } from './SatelliteInfo';
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
  onPractice,
  onStation,
  onFeatured,
  scope,
  onScope,
  chosen,
  onChosen,
  query,
  onQuery,
  onClearFilters,
  qsos,
  favorites,
  onFavorite,
}: {
  catalog: LoadedCatalog;
  location: Location;
  station: Station;
  /** A pass the user picked (here, or from Learn). null = the next good pass. */
  selected: Pass | null;
  onSelect: (p: Pass | null) => void;
  onStart: (pass: Pass, sat: Satellite) => void;
  onPractice: (pass: Pass, sat: Satellite) => void;
  onStation: (station: Station) => void;
  onFeatured: (id: number) => void;
  query: string;
  onQuery: (query: string) => void;
  onClearFilters: () => void;
  /** Which satellites the lists cover. Kept by App so it survives switching tabs. */
  scope: SatScope;
  onScope: (s: SatScope) => void;
  /** No activity keys pressed = no filter. Saved on this device by App. */
  chosen: ReadonlySet<Activity>;
  onChosen: (a: ReadonlySet<Activity>) => void;
  /** The log, for "your contacts" on the info sheet. */
  qsos: QsoRecord[];
  /** Favorite satellites (NORAD ids), kept on this device. */
  favorites: ReadonlySet<number>;
  onFavorite: (noradId: number) => void;
}) {
  const now = useNow(1000);
  const [info, setInfo] = useState<Satellite | null>(null);

  // Picking a pass anywhere below swaps the card at the top; take the user to it, and move focus
  // there too so a screen reader follows.
  const cardRef = useRef<HTMLDivElement>(null);
  const pick = useCallback(
    (p: Pass | null) => {
      onSelect(p);
      requestAnimationFrame(() => {
        const el = cardRef.current;
        if (!el) return;
        const calm = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
        el.scrollIntoView({ behavior: calm ? 'auto' : 'smooth', block: 'start' });
        el.focus({ preventScroll: true });
      });
    },
    [onSelect],
  );

  const counts = useMemo(
    () =>
      Object.fromEntries(
        (Object.keys(SCOPE_OPTS) as SatScope[]).map((k) => [
          k,
          listedSatellites(catalog.catalog, station.experience, { ...SCOPE_OPTS[k], showAll: SCOPE_OPTS[k].showAll || station.goal === 'explore' || station.equipment === 'ssb', favorites }).filter((s) => k !== 'recommended' || matchesOperator(s, station)).length,
        ]),
      ) as Record<SatScope, number>,
    [catalog, station.experience, station.goal, station.equipment, favorites],
  );
  const q = query.trim().toLowerCase();
  const act = chosen;
  const sats = useMemo(
    () => listedSatellites(catalog.catalog, station.experience, { ...SCOPE_OPTS[scope], showAll: SCOPE_OPTS[scope].showAll || station.goal === 'explore' || station.equipment === 'ssb', favorites })
      .filter((s) => scope !== 'recommended' || matchesOperator(s, station)),
    [catalog, station.experience, station.goal, station.equipment, scope, favorites],
  );
  const { passes, error } = usePasses(sats, location);

  const upcoming = useMemo(() => (passes ?? []).filter((p) => p.los > now), [passes, now]);
  // Predict once for the scope; search and activities govern the card and both lists.
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
  const next = useMemo(
    () => nextGoodPass(shownPasses, shownById, station.experience, now, station.hours),
    [shownPasses, shownById, station.experience, now, station.hours],
  );
  const featured = selected && selected.locationId === location.id && selected.los > now && shownById.has(selected.noradId) ? selected : next;
  const featuredSat = featured ? shownById.get(featured.noradId) : undefined;
  useEffect(() => { if (featured) onFeatured(featured.noradId); }, [featured?.noradId, onFeatured]);

  const catalogDays = elementAgeDays(catalog.catalog.generatedAt, now);

  return (
    <div className="stack">
      <Fold title={`${station.goal === 'listen' ? 'Listen' : station.goal === 'contacts' ? 'Make contacts' : 'Explore'} · goal and radio`}>
        <OperatingPreferences station={station} onChange={onStation} />
      </Fold>
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
        <div ref={cardRef} tabIndex={-1} className="card-anchor" key={`${featured.noradId}-${featured.aos}`}>
          <PassCard
            pass={featured}
            sat={featuredSat}
            location={location}
            station={station}
            now={now}
            isNext={next !== null && samePass(featured, next)}
            outsideHours={featured.aos > now && !inHours(featured.aos, station.hours)}
            onBackToNext={selected ? () => pick(null) : undefined}
            onStart={() => onStart(featured, featuredSat)}
            onPractice={() => onPractice(featured, featuredSat)}
            onInfo={() => setInfo(featuredSat)}
            favorite={favorites.has(featuredSat.noradId)}
            onFavorite={() => onFavorite(featuredSat.noradId)}
          />
        </div>
      ) : (
        <Banner tone="info">
          {scope === 'favorites' && sats.length === 0 ? (
            <>No favorites yet. Tap ★ on a satellite’s card or info sheet to add it.</>
          ) : scope === 'recommended' && station.goal === 'contacts' && station.equipment === 'sdr' ? (
            <>Your SDR receiver can listen. Choose Listen in “goal and radio” above, or select a station that can transmit to find contact opportunities.</>
          ) : (
            <>
              {shownPasses.some((p) => shownById.has(p.noradId) && isGoodPass(p, station.experience))
                ? `The good passes in the next 24 hours from ${location.name} are on satellites that are probably off. They’re marked in the list below.`
                : `No good passes in the next 24 hours for these satellites from ${location.name}.`}
              {filtered ? ' Clear the filters or browse other satellites.' : scope === 'recommended' && ' Try Available below, or change your goal and radio.'}
            </>
          )}
        </Banner>
      )}

      <section aria-label="Satellites">
        <SectionTitle>Satellites</SectionTitle>
        <Segmented
          label="Satellites"
          value={scope}
          onChange={onScope}
          options={[
            { value: 'favorites', label: `★ Favorites ${counts.favorites}` },
            { value: 'recommended', label: `Recommended ${counts.recommended}` },
            { value: 'all', label: `Available ${counts.all}` },
            { value: 'inactive', label: `Full catalog ${counts.inactive}` },
          ]}
        />
        <p className="hint" style={{ marginTop: 6 }}>
          {scope === 'favorites'
            ? 'Satellites you starred. They’re saved on this device only; no account needed.'
            : scope === 'recommended'
            ? 'Targets for your goal, radio and experience preset.'
            : scope === 'all'
              ? 'Satellites not reported inactive, including those with unknown status.'
              : 'Everything in the catalog, including satellites reported inactive and objects not yet identified.'}{' '}
          The featured pass, list and timeline all follow your filters.
        </p>
        {(
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
        {(
          <Field
            label="Find a satellite"
            type="search"
            value={query}
            placeholder="AO-91, ISS, SO-50…"
            autoCapitalize="characters"
            autoCorrect="off"
            spellCheck={false}
            onChange={(e) => onQuery(e.target.value)}
          />
        )}
        {filtered && (
          <p className="hint" role="status" style={{ marginTop: 8 }}>
            Showing {shownSats.length} of {sats.length} satellites.{' '}
            <button
              type="button"
              className="linkish"
              onClick={onClearFilters}
            >
              Clear filters
            </button>
          </p>
        )}
      </section>

      {passes && (
        <>
          <PassList key={`list:${listKey}`} passes={shownPasses} sats={shownById} station={station} now={now} selected={featured} onSelect={pick} favorites={favorites} />
          <Timeline
            key={`timeline:${listKey}`}
            passes={shownPasses}
            sats={shownSats}
            station={station}
            now={now}
            selected={featured}
            onSelect={pick}
          />
        </>
      )}

      {info && (
        <SatelliteInfo
          sat={info}
          location={location}
          station={station}
          now={now}
          passes={upcoming.filter((p) => p.noradId === info.noradId)}
          qsos={qsos}
          onPick={(p) => {
            setInfo(null);
            pick(p);
          }}
          onClose={() => setInfo(null)}
          favorite={favorites.has(info.noradId)}
          onFavorite={() => onFavorite(info.noradId)}
        />
      )}
    </div>
  );
}

const SCOPE_OPTS: Record<SatScope, ListOptions> = {
  favorites: { showAll: false, showInactive: true, onlyFavorites: true },
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
          Orbit data over 14 days old for {names(stale)}. Their pass times are approximate.
        </Banner>
      )}
      {aging.length > 0 && <Banner tone="warn">Orbit data 3–14 days old for {names(aging)}.</Banner>}
    </div>
  );
}
