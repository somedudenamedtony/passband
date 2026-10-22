// SPEC-v2 §6: three tabs (Now · Plan · Log), a header with the location and station, and one
// screen per URL. Back (the ← key, the edge swipe, the browser) goes up one level (D22).

import { useEffect, useRef, useState } from 'react';
import { goUp, navigate, parentOf, tabOf, type Route, type Tab } from '../router';
import { store, useActiveLocation, useAppState } from '../store/store';
import { useBack } from '../ui/back';
import { Banner, Button } from '../ui/common';
import { EdgeSwipe } from '../ui/EdgeSwipe';
import { Icon } from '../ui/icons';
import { TabBar, type TabSpec } from '../ui/TabBar';
import { Link } from './Link';
import { NowScreen } from '../routes/Now';
import { PassPage } from '../routes/PassPage';
import { LivePage } from '../routes/LivePage';
import {
  ContactScreen, LogScreen, NotFoundScreen, PlanScreen, SatelliteScreen, StationScreen,
} from '../routes/screens';
import { toV1Station } from '../model/stationV2';
import { LocationSheet } from '../ui/LocationSheet';

const TABS = [
  { id: 'now', label: 'Now', icon: 'pass' },
  { id: 'plan', label: 'Plan', icon: 'plan' },
  { id: 'log', label: 'Log', icon: 'log' },
] as const satisfies ReadonlyArray<TabSpec<Tab>>;

function Screen({ route }: { route: Exclude<Route, { name: 'classic' }> }) {
  switch (route.name) {
    case 'now': return <NowScreen />;
    case 'plan': return <PlanScreen />;
    case 'log': return <LogScreen />;
    case 'contact': return <ContactScreen qsoId={route.qsoId} />;
    case 'pass': return <PassPage id={route.passId} />;
    case 'live': return null; // drawn full screen by Shell
    case 'sat': return <SatelliteScreen noradId={route.noradId} />;
    case 'station': return <StationScreen />;
    case 'notFound': return <NotFoundScreen />;
  }
}

export function Shell({ route }: { route: Exclude<Route, { name: 'classic' }> }) {
  useEffect(() => { void store.load(); }, []);
  const status = useAppState((s) => s.status);
  const noCatalog = useAppState((s) => s.status === 'ready' && s.catalog === null);
  const callsign = useAppState((s) => s.station?.callsign ?? '');
  const location = useActiveLocation();
  const locations = useAppState((s) => s.locations);
  const station = useAppState((s) => s.station);
  const [locating, setLocating] = useState(false);
  const tab = tabOf(route);
  const hasParent = parentOf(route) !== null;
  const live = route.name === 'live';
  useBack(goUp, hasParent && !live);

  const pageRef = useRef<HTMLElement>(null);
  const key = JSON.stringify(route);
  useEffect(() => { pageRef.current?.scrollTo({ top: 0 }); }, [key]);

  if (live) return status === 'loading' ? null : <LivePage id={route.passId} startPractice={route.practice === true} />;

  return (
    <div className="shell">
      <header className="topbar">
        {hasParent ? (
          <Button expand="inline" className="key-icon" onClick={goUp} aria-label="Back">
            <Icon name="chevronLeft" />
          </Button>
        ) : (
          <span className="wordmark">Passband</span>
        )}
        <span className="topbar-rule" aria-hidden />
        {location && (
          <Button expand="inline" size="small" onClick={() => setLocating(true)} aria-label={`Location: ${location.name}`}>
            <Icon name="location" size={16} />
            {location.name}
          </Button>
        )}
        <Link to={{ name: 'station' }} className="key key-secondary key-sm" aria-label="Station">
          {callsign || 'Set up'}
        </Link>
      </header>
      <main className="page" ref={pageRef}>
        <div className="page-inner stack">
          {noCatalog && (
            <Banner tone="danger">
              Couldn’t load satellite data, and none is saved on this device yet. Connect once to download it; after that
              Passband works offline.
              <Button kind="secondary" expand="inline" size="small" onClick={() => void store.retryCatalog()}>
                Try again
              </Button>
            </Banner>
          )}
          {status === 'loading' ? <p className="muted">Loading…</p> : <Screen route={route} />}
        </div>
      </main>
      <TabBar tabs={TABS} selected={tab ?? ('' as Tab)} onSelect={(t) => navigate({ name: t })} />
      {locating && station && (
        <LocationSheet
          locations={locations}
          activeId={location?.id ?? null}
          onSelect={(id) => void store.setActiveLocation(id)}
          onAdd={(l) => void store.saveLocation(l)}
          onDelete={(id) => void store.deleteLocation(id)}
          onUpdate={(l) => void store.saveLocation(l)}
          station={toV1Station(station)}
          onClose={() => setLocating(false)}
        />
      )}
      <EdgeSwipe />
    </div>
  );
}
