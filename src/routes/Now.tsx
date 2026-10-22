// SPEC-v2 §6.1: the next pass at a glance, then today's passes, one line each. No selector, no
// filters, no timeline: one toggle widens the list to everything workable.

import { useState } from 'react';
import { Link } from '../app/Link';
import { passFacts, ModeChip, OnAirMark, PassRow, QualityBar, type PassFacts } from '../components/pass';
import { formatCountdown, formatLocalTime } from '../model/format';
import { passId } from '../model/passId';
import { dayPart, direction, passSentence, phaseOf } from '../model/passView';
import type { Plan } from '../model/plan';
import { nextGoodPass } from '../model/selection';
import { sunPosition } from '../model/sun';
import { DAY, MINUTE } from '../model/time';
import type { Location, Pass } from '../model/types';
import type { StationV2 } from '../model/stationV2';
import { usePasses, useSatelliteMap } from '../store/passes';
import { useShownSatellites } from '../store/selection';
import { store, useActiveLocation, useAppState } from '../store/store';
import { useNow } from '../ui/clock';
import { Banner, Panel, Toggle } from '../ui/common';
import { LocationForm } from '../ui/LocationSetup';

/** Include passes already up, so "up now" shows. */
const LOOK_BACK = 20 * MINUTE;

export function planFor(pass: Pass, location: Location, now: number): Plan {
  return {
    id: passId(pass.noradId, pass.aos), noradId: pass.noradId, aos: pass.aos, los: pass.los,
    locationId: location.id, transmitterId: null, note: '', outcome: 'planned', createdAt: now,
  };
}

export function NowScreen() {
  const location = useActiveLocation();
  const station = useAppState((s) => s.station);
  const hasCatalog = useAppState((s) => s.catalog !== null);
  if (!location) {
    return (
      <div className="stack">
        <h1 className="screen-title">Where are you?</h1>
        <p>Passband works out passes for where you stand. Your location stays on this device.</p>
        <Panel>
          <LocationForm submitLabel="Show my passes" onSave={(l) => void store.saveLocation(l)} />
        </Panel>
      </div>
    );
  }
  if (!station || !hasCatalog) return <h1 className="screen-title">Now</h1>;
  return <NowPasses location={location} station={station} />;
}

function NowPasses({ location, station }: { location: Location; station: StationV2 }) {
  const now = useNow(15_000);
  const sats = useShownSatellites();
  const satMap = useSatelliteMap(sats);
  const plans = useAppState((s) => s.plans);
  const planned = new Set(plans.map((p) => p.id));
  const { passes, error } = usePasses(sats, location, -LOOK_BACK, DAY);
  const [openLow, setOpenLow] = useState<Set<string>>(() => new Set());

  const upcoming = (passes ?? []).filter((p) => p.los > now && satMap.has(p.noradId));
  const facts = upcoming.map((p) => passFacts(p, satMap.get(p.noradId)!, station, now));
  const next =
    facts.find((f) => planned.has(passId(f.pass.noradId, f.pass.aos))) ??
    facts.find((f) => f.pass === nextGoodPass(upcoming, satMap, station.guidance === 'guided' ? 'new' : 'experienced', now, station.hours)) ??
    null;
  const rest = facts.filter((f) => f !== next);
  const toggle = (p: Pass) => {
    const id = passId(p.noradId, p.aos);
    void (planned.has(id) ? store.removePlan(id) : store.savePlan(planFor(p, location, now)));
  };

  const groups: Array<{ label: string; rows: PassFacts[] }> = [];
  for (const f of rest) {
    const label = dayPart(f.pass.aos, now, sunPosition(f.pass.aos, location.latDeg, location.lonDeg).elDeg < 0);
    const g = groups[groups.length - 1];
    if (g?.label === label) g.rows.push(f);
    else groups.push({ label, rows: [f] });
  }

  return (
    <div className="stack">
      <h1 className="screen-title">Now</h1>
      {error && <Banner tone="danger">Couldn’t work out passes: {error}</Banner>}
      {passes === null && !error && <p className="muted">Working out passes…</p>}
      {next ? (
        <NextUp facts={next} now={now} planned={planned.has(passId(next.pass.noradId, next.pass.aos))} onTogglePlan={() => toggle(next.pass)} />
      ) : (
        passes !== null && (
          <Panel label="Next up">
            <p>Nothing worth going out for in the next 24 hours. The list below has every pass, low ones included.</p>
          </Panel>
        )
      )}

      <section aria-labelledby="today-h" className="stack">
        <div className="section-head">
          <h2 id="today-h" className="section-title">Next 24 hours</h2>
          <Toggle checked={station.showEverythingWorkable} onChange={(v) => void store.updateStation({ showEverythingWorkable: v })}>
            Everything workable
          </Toggle>
        </div>
        {station.mySatellites.length === 0 && (
          <p className="muted">Showing every satellite that works with your radio. Star passes and satellites to make this your list.</p>
        )}
        {groups.map((g) => {
          const good = g.rows.filter((f) => f.quality !== 'low');
          const low = g.rows.filter((f) => f.quality === 'low');
          const showLow = openLow.has(g.label);
          const rows = showLow ? g.rows : good;
          return (
            <div key={g.label} className="pass-group">
              <h3 className="pass-group-title">{g.label}</h3>
              <ul className="pass-rows">
                {rows.map((f) => (
                  <PassRow key={passId(f.pass.noradId, f.pass.aos)} facts={f} now={now} planned={planned.has(passId(f.pass.noradId, f.pass.aos))} onTogglePlan={() => toggle(f.pass)} />
                ))}
              </ul>
              {low.length > 0 && (
                <button type="button" className="pass-low" aria-expanded={showLow} onClick={() => setOpenLow((s) => {
                  const n = new Set(s);
                  if (showLow) n.delete(g.label); else n.add(g.label);
                  return n;
                })}>
                  {showLow ? 'Hide low passes' : `${low.length} low ${low.length === 1 ? 'pass' : 'passes'}`}
                </button>
              )}
            </div>
          );
        })}
      </section>
    </div>
  );
}

function NextUp({ facts, now, planned, onTogglePlan }: { facts: PassFacts; now: number; planned: boolean; onTogglePlan: () => void }) {
  const { pass, sat, guide, outlook } = facts;
  const id = passId(pass.noradId, pass.aos);
  const phase = phaseOf(pass, now);
  const up = phase === 'during';
  const onAir = outlook.level === 'likely' ? 'heard lately' : outlook.short;
  return (
    <section className="panel next-up stack" aria-label={`Next up: ${sat.name}`}>
      <div className="next-up-head">
        <span className="lcd-label">{planned ? '★ Planned' : 'Next up'}</span>
        <span className="next-up-count mono">{up ? `sets ${formatCountdown(pass.los - now)}` : formatCountdown(pass.aos - now)}</span>
      </div>
      <Link to={{ name: 'pass', passId: id }} className="next-up-main">
        <span className="next-up-name">{sat.name}</span>
        <ModeChip guide={guide} />
        <span className="next-up-facts mono">
          {up ? 'UP' : formatLocalTime(pass.aos)} · <QualityBar q={facts.quality} /> {Math.round(pass.maxElDeg)}° · {direction(pass)} · <OnAirMark outlook={outlook} />
        </span>
      </Link>
      <p>{passSentence(pass, now, facts.quality, guide?.what ?? 'mode Unknown', onAir)}</p>
      <div className="next-up-actions">
        {phase === 'before' ? (
          <Link to={{ name: 'pass', passId: id }} className="key key-primary key-block">Prepare</Link>
        ) : (
          <Link to={{ name: 'live', passId: id }} className="key key-primary key-block">Track</Link>
        )}
        <button type="button" className="key key-secondary" aria-pressed={planned} onClick={onTogglePlan}>
          {planned ? '★ Going' : '☆ Going'}
        </button>
      </div>
    </section>
  );
}
