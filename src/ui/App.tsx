import { useCallback, useEffect, useState } from 'react';
import { loadCatalog, type LoadedCatalog } from '../data/catalog';
import {
  getActiveLocationId,
  listLocations,
  saveLocation,
  setActiveLocationId,
  deleteLocation,
} from '../data/locations';
import { DEFAULT_STATION, loadStation, saveStation } from '../data/station';
import { applyTheme, loadTheme, saveTheme, type Theme } from '../data/theme';
import type { Location, Station } from '../model/types';
import { Banner, Button } from './common';
import { LocationSheet } from './LocationSheet';
import { LocationSetup } from './LocationSetup';
import { SettingsSheet } from './SettingsSheet';
import { Tonight } from './Tonight';

type Sheet = 'none' | 'locations' | 'settings';

export function App() {
  const [ready, setReady] = useState(false);
  const [catalog, setCatalog] = useState<LoadedCatalog | null>(null);
  const [catalogError, setCatalogError] = useState(false);
  const [station, setStation] = useState<Station>(DEFAULT_STATION);
  const [theme, setTheme] = useState<Theme>('auto');
  const [locations, setLocations] = useState<Location[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [sheet, setSheet] = useState<Sheet>('none');

  useEffect(() => {
    void (async () => {
      const [s, t, locs, active] = await Promise.all([loadStation(), loadTheme(), listLocations(), getActiveLocationId()]);
      setStation(s);
      setTheme(t);
      applyTheme(t);
      setLocations(locs);
      setActiveId(active && locs.some((l) => l.id === active) ? active : (locs[0]?.id ?? null));
      setReady(true);
      const c = await loadCatalog();
      setCatalog(c);
      setCatalogError(c === null);
    })();
  }, []);

  const updateStation = useCallback((s: Station) => {
    setStation(s);
    void saveStation(s);
  }, []);

  const updateTheme = useCallback((t: Theme) => {
    setTheme(t);
    applyTheme(t);
    void saveTheme(t);
  }, []);

  const addLocation = useCallback(async (loc: Location) => {
    await saveLocation(loc);
    await setActiveLocationId(loc.id);
    setLocations(await listLocations());
    setActiveId(loc.id);
  }, []);

  const selectLocation = useCallback(async (id: string) => {
    await setActiveLocationId(id);
    setActiveId(id);
  }, []);

  const removeLocation = useCallback(
    async (id: string) => {
      await deleteLocation(id);
      const locs = await listLocations();
      setLocations(locs);
      if (activeId === id) {
        const next = locs[0]?.id ?? null;
        setActiveId(next);
        if (next) await setActiveLocationId(next);
      }
    },
    [activeId],
  );

  const location = locations.find((l) => l.id === activeId) ?? null;

  if (!ready) return null;

  return (
    <div className="mx-auto flex min-h-dvh max-w-lg flex-col px-4">
      <header className="sticky top-0 z-10 flex items-center gap-2 bg-bg py-3">
        {location ? (
          <button
            type="button"
            onClick={() => setSheet('locations')}
            className="min-h-12 flex-1 truncate rounded-full border border-line bg-surface px-4 text-left font-semibold"
          >
            <span aria-hidden>📍 </span>
            {location.name}
            {location.name !== location.grid6.slice(0, 4) && <span className="text-muted"> · {location.grid6.slice(0, 4)}</span>}
          </button>
        ) : (
          <h1 className="flex-1 text-xl font-bold">Passband</h1>
        )}
        <button
          type="button"
          onClick={() => setSheet('settings')}
          className="min-h-12 min-w-12 rounded-full border border-line bg-surface text-xl"
          aria-label="Settings"
        >
          ⚙
        </button>
      </header>

      <main className="flex-1 pb-8">
        {catalogError && (
          <Banner tone="danger">
            Couldn’t load satellite data, and none is saved on this device yet. Connect once to download
            it; after that Passband works offline.
            <div className="mt-2">
              <Button
                onClick={() => {
                  setCatalogError(false);
                  void loadCatalog().then((c) => {
                    setCatalog(c);
                    setCatalogError(c === null);
                  });
                }}
              >
                Try again
              </Button>
            </div>
          </Banner>
        )}
        {!location ? (
          <LocationSetup onSave={addLocation} />
        ) : catalog ? (
          <Tonight catalog={catalog} location={location} station={station} />
        ) : (
          !catalogError && <p className="py-8 text-center text-muted">Loading satellite data…</p>
        )}
      </main>

      {sheet === 'locations' && (
        <LocationSheet
          locations={locations}
          activeId={activeId}
          onSelect={(id) => {
            void selectLocation(id);
            setSheet('none');
          }}
          onAdd={async (loc) => {
            await addLocation(loc);
            setSheet('none');
          }}
          onDelete={removeLocation}
          onClose={() => setSheet('none')}
        />
      )}
      {sheet === 'settings' && (
        <SettingsSheet
          station={station}
          onChange={updateStation}
          theme={theme}
          onTheme={updateTheme}
          catalog={catalog}
          onClose={() => setSheet('none')}
        />
      )}
    </div>
  );
}
