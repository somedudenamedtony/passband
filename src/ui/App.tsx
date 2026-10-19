import { useCallback, useEffect, useState } from 'react';
import { SimulatedClock, systemClock } from '../clock';
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
import { LiveScreen } from '../live/LiveScreen';
import { SECOND } from '../model/time';
import type { PracticeRate } from '../model/practice';
import type { Location, Pass, QsoRecord, Recording, Satellite, Station } from '../model/types';
import { deleteQso, listQsos, markExported, saveQso } from '../data/log';
import { deleteRecording, listRecordings } from '../data/recordings';
import { EXPORT_NUDGE, LogView, unexportedCount } from './LogView';
import { ClockContext } from './clock';
import { Banner, Button } from './common';
import { TabBar, type TabSpec } from './TabBar';
import { Icon } from './icons';
import { Learn } from './Learn';
import { MapView } from './MapView';
import { LocationSheet } from './LocationSheet';
import { LocationSetup } from './LocationSetup';
import { SettingsSheet } from './SettingsSheet';
import { Tonight, type SatScope } from './Tonight';
import type { Activity } from '../model/activity';

type Sheet = 'none' | 'locations' | 'settings';
type Tab = 'tonight' | 'map' | 'log' | 'learn';

interface Live {
  pass: Pass;
  sat: Satellite;
  /** D16: practice is the live screen on a simulated clock. */
  practice?: { clock: SimulatedClock; rate: PracticeRate };
}

export function App() {
  const [ready, setReady] = useState(false);
  const [catalog, setCatalog] = useState<LoadedCatalog | null>(null);
  const [catalogError, setCatalogError] = useState(false);
  const [station, setStation] = useState<Station>(DEFAULT_STATION);
  const [theme, setTheme] = useState<Theme>('auto');
  const [locations, setLocations] = useState<Location[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [sheet, setSheet] = useState<Sheet>('none');
  const [live, setLive] = useState<Live | null>(null);
  const [tab, setTab] = useState<Tab>('tonight');
  const [selected, setSelected] = useState<Pass | null>(null);
  const [scope, setScope] = useState<SatScope>('recommended');
  const [chosen, setChosen] = useState<ReadonlySet<Activity>>(() => new Set());
  const [qsos, setQsos] = useState<QsoRecord[]>([]);
  const [recordings, setRecordings] = useState<Recording[]>([]);
  const refreshRecordings = useCallback(async () => setRecordings(await listRecordings()), []);

  const refreshLog = useCallback(async () => setQsos(await listQsos()), []);
  const logQso = useCallback(
    async (q: QsoRecord) => {
      await saveQso(q);
      await refreshLog();
    },
    [refreshLog],
  );

  // The live screen is a history entry, so the phone's back button leaves it.
  useEffect(() => {
    const onPop = () => setLive(null);
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);
  const openLive = useCallback((pass: Pass, sat: Satellite) => {
    history.pushState({ live: true }, '');
    setLive({ pass, sat });
  }, []);
  const openPractice = useCallback((pass: Pass, sat: Satellite) => {
    history.pushState({ live: true }, '');
    // Start a minute before AOS: enough to see the pre-pass state and hear the rise cue.
    setLive({ pass, sat, practice: { clock: new SimulatedClock(pass.aos - 60 * SECOND, 1), rate: 1 } });
  }, []);
  const setPracticeRate = useCallback((rate: PracticeRate) => {
    setLive((l) => (l?.practice ? { ...l, practice: { clock: new SimulatedClock(l.practice.clock.now(), rate), rate } } : l));
  }, []);
  const closeLive = useCallback(() => {
    if ((history.state as { live?: boolean } | null)?.live) history.back();
    else setLive(null);
  }, []);

  useEffect(() => {
    void (async () => {
      const [s, t, locs, active] = await Promise.all([loadStation(), loadTheme(), listLocations(), getActiveLocationId()]);
      setStation(s);
      setTheme(t);
      applyTheme(t);
      setLocations(locs);
      setActiveId(active && locs.some((l) => l.id === active) ? active : (locs[0]?.id ?? null));
      setQsos(await listQsos());
      setRecordings(await listRecordings());
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

  const tabs = [
    { id: 'tonight', label: 'Tonight', icon: 'pass' },
    { id: 'map', label: 'Map', icon: 'map' },
    { id: 'log', label: 'Log', icon: 'log' },
    { id: 'learn', label: station.experience === 'new' ? 'Learn' : 'Help', icon: 'learn' },
  ] as const satisfies ReadonlyArray<TabSpec<Tab>>;
  return (
    <>
      <div className="shell" inert={live !== null}>
        <header className="topbar">
          <span className="wordmark">Passband</span>
          <span className="topbar-rule" aria-hidden />
          {location && (
            <Button expand="inline" size="small" onClick={() => setSheet('locations')} aria-label={`Location: ${location.name}`}>
              <Icon name="location" size={16} />
              {location.name}
            </Button>
          )}
          <Button expand="inline" className="key-icon" onClick={() => setSheet('settings')} aria-label="Settings">
            <Icon name="settings" />
          </Button>
        </header>

        <main className="page">
          <div className="page-inner stack">
            {catalogError && (
              <Banner tone="danger">
                Couldn’t load satellite data, and none is saved on this device yet. Connect once to download it;
                after that Passband works offline.
                <Button
                  kind="secondary"
                  expand="inline"
                  size="small"
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
              </Banner>
            )}
            {!location ? (
              <LocationSetup onSave={addLocation} />
            ) : catalog ? (
              tab === 'map' ? (
                <MapView catalog={catalog} location={location} station={station} qsos={qsos} />
              ) : tab === 'log' ? (
                <LogView
                  qsos={qsos}
                  station={station}
                  onSave={(q) => void logQso(q)}
                  onDelete={(id) => void deleteQso(id).then(refreshLog)}
                  onExported={(ids, at) => void markExported(ids, at).then(refreshLog)}
                  recordings={recordings}
                  onDeleteRecording={(id) => void deleteRecording(id).then(refreshRecordings)}
                  catalog={catalog}
                  locations={locations}
                />
              ) : tab === 'tonight' ? (
                <>
                  {unexportedCount(qsos) >= EXPORT_NUDGE && (
                    <Banner tone="warn">
                      {unexportedCount(qsos)} contacts aren’t exported yet.{' '}
                      <a href="#log" onClick={(e) => { e.preventDefault(); setTab('log'); }}>
                        Export from the Log
                      </a>
                    </Banner>
                  )}
                  <Tonight
                    catalog={catalog}
                    location={location}
                    station={station}
                    selected={selected}
                    onSelect={setSelected}
                    onStart={openLive}
                    scope={scope}
                    onScope={setScope}
                    chosen={chosen}
                    onChosen={setChosen}
                  />
                </>
              ) : (
                <Learn
                  catalog={catalog}
                  location={location}
                  station={station}
                  onPick={(p) => {
                    setSelected(p);
                    setTab('tonight');
                  }}
                  onPractice={openPractice}
                />
              )
            ) : (
              !catalogError && (
                <p className="center muted" style={{ padding: '32px 0' }}>
                  Loading satellite data…
                </p>
              )
            )}
          </div>
        </main>

        {location && catalog && <TabBar tabs={tabs} selected={tab} onSelect={setTab} />}
      </div>

      {live && location && (
        <ClockContext.Provider value={live.practice?.clock ?? systemClock}>
          <LiveScreen
            pass={live.pass}
            sat={live.sat}
            location={location}
            station={station}
            onClose={closeLive}
            onLog={(q) => void logQso(q)}
            onRecorded={() => void refreshRecordings()}
            practice={live.practice && { rate: live.practice.rate, onRate: setPracticeRate }}
          />
        </ClockContext.Provider>
      )}
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
          station={station}
          onUpdate={async (loc) => {
            await saveLocation(loc);
            setLocations(await listLocations());
          }}
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
          location={location}
          onClose={() => setSheet('none')}
        />
      )}
    </>
  );
}
