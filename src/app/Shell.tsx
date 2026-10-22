// SPEC-v2 §6: three tabs (Now · Plan · Log), a header with the location and station, and one
// screen per URL. Back (the ← key, the edge swipe, the browser) goes up one level (D22).

import { useEffect, useRef } from 'react';
import { goUp, navigate, parentOf, tabOf, type Route, type Tab } from '../router';
import { store, useActiveLocation, useAppState } from '../store/store';
import { useBack } from '../ui/back';
import { Banner, Button, Tag } from '../ui/common';
import { EdgeSwipe } from '../ui/EdgeSwipe';
import { Icon } from '../ui/icons';
import { TabBar, type TabSpec } from '../ui/TabBar';
import { Link } from './Link';
import {
  ContactScreen, LogScreen, NotFoundScreen, NowScreen, PassScreen, PlanScreen, SatelliteScreen, StationScreen,
} from '../routes/screens';

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
    case 'pass': return <PassScreen passId={route.passId} />;
    case 'live': return <PassScreen passId={route.passId} live />;
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
  const tab = tabOf(route);
  const hasParent = parentOf(route) !== null;
  const live = route.name === 'live';
  useBack(goUp, hasParent);

  const pageRef = useRef<HTMLElement>(null);
  const key = JSON.stringify(route);
  useEffect(() => { pageRef.current?.scrollTo({ top: 0 }); }, [key]);

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
        {!live && (
          <>
            {/* The location switcher and library search arrive with R2 and R6. */}
            {location && <Tag>{location.name}</Tag>}
            <Link to={{ name: 'station' }} className="key key-secondary key-sm" aria-label="Station">
              {callsign || 'Set up'}
            </Link>
          </>
        )}
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
      {!live && <TabBar tabs={TABS} selected={tab ?? ('' as Tab)} onSelect={(t) => navigate({ name: t })} />}
      <EdgeSwipe />
    </div>
  );
}
