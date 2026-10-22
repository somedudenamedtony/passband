// SPEC-v2 §6.4: the week ahead for My satellites, so you can decide where your evenings go. Days
// carry sunset and sunrise; planned passes pin to the top of their day; passes outside your hours
// are dimmed, never hidden; overlapping plans are flagged (D25); planned passes export together.

import { useMemo, useState, type ReactNode } from 'react';
import { passFacts, PassRow, type PassFacts } from '../components/pass';
import { formatLocalDay, formatLocalTimeShort } from '../model/format';
import { passId } from '../model/passId';
import { localDayStart } from '../model/passView';
import { clashingIds } from '../model/plan';
import { inHours } from '../model/selection';
import { toV1Station, type StationV2 } from '../model/stationV2';
import { sunEvents } from '../model/sun';
import { DAY } from '../model/time';
import type { Location, Pass } from '../model/types';
import { usePasses, useSatelliteMap } from '../store/passes';
import { useShownSatellites } from '../store/selection';
import { store, useActiveLocation, useAppState } from '../store/store';
import { exportPlannedToCalendar } from '../ui/calendar';
import { useNow } from '../ui/clock';
import { Banner, Button } from '../ui/common';
import { Icon } from '../ui/icons';
import { planFor } from './Now';

const WEEK = 7 * DAY;
/** Rows a day shows before "Show more": a week of everything workable runs to thousands. */
const DAY_ROWS = 12;

export function PlanScreen() {
  const location = useActiveLocation();
  const station = useAppState((s) => s.station);
  const hasCatalog = useAppState((s) => s.catalog !== null);
  if (!location || !station || !hasCatalog) {
    return (
      <div className="stack">
        <h1 className="screen-title">Plan</h1>
        {!location && <p>Set where you are on Now first; the week is worked out for that place.</p>}
      </div>
    );
  }
  return <Week location={location} station={station} />;
}

interface Filters {
  plannedOnly: boolean;
  greatOnly: boolean;
  inMyHours: boolean;
  modes: Set<string>;
}

function Week({ location, station }: { location: Location; station: StationV2 }) {
  const now = useNow(60_000);
  const sats = useShownSatellites();
  const satMap = useSatelliteMap(sats);
  const plans = useAppState((s) => s.plans);
  const { passes, error } = usePasses(sats, location, 0, WEEK);
  const [f, setF] = useState<Filters>({ plannedOnly: false, greatOnly: false, inMyHours: false, modes: new Set() });

  const planned = useMemo(() => new Set(plans.filter((p) => p.outcome === 'planned').map((p) => p.id)), [plans]);
  const clashes = useMemo(() => clashingIds(plans), [plans]);
  const facts = useMemo(
    () => (passes ?? []).filter((p) => p.los > now && satMap.has(p.noradId)).map((p) => passFacts(p, satMap.get(p.noradId)!, station, now)),
    [passes, satMap, station, now],
  );
  const modes = useMemo(() => [...new Set(facts.map((x) => x.guide?.label ?? 'Unknown'))].sort(), [facts]);
  const id = (p: Pass) => passId(p.noradId, p.aos);
  const shown = facts.filter(
    (x) =>
      (!f.plannedOnly || planned.has(id(x.pass))) &&
      (!f.greatOnly || x.quality === 'great') &&
      (!f.inMyHours || inHours(x.pass.aos, station.hours)) &&
      (f.modes.size === 0 || f.modes.has(x.guide?.label ?? 'Unknown')),
  );

  const days: Array<{ start: number; rows: PassFacts[] }> = [];
  for (const x of shown) {
    const start = localDayStart(x.pass.aos);
    const d = days[days.length - 1];
    if (d?.start === start) d.rows.push(x);
    else days.push({ start, rows: [x] });
  }
  for (const d of days) d.rows.sort((a, b) => Number(planned.has(id(b.pass))) - Number(planned.has(id(a.pass))) || a.pass.aos - b.pass.aos);

  const toggle = (p: Pass) => void (planned.has(id(p)) ? store.removePlan(id(p)) : store.savePlan(planFor(p, location, now)));
  const plannedItems = facts.filter((x) => planned.has(id(x.pass))).map((x) => ({ pass: x.pass, sat: x.sat }));
  const chip = (label: string, on: boolean, flip: () => void) => (
    <button key={label} type="button" className="key key-secondary key-sm" aria-pressed={on} onClick={flip}>
      {label}
    </button>
  );

  return (
    <div className="stack">
      <h1 className="screen-title">Plan</h1>
      <p className="muted">The next 7 days from {location.name}. ★ a pass to plan it.</p>
      {error && <Banner tone="danger">Couldn’t work out passes: {error}</Banner>}
      {clashes.size > 0 && <Banner tone="warn">Some planned passes overlap. You can only point at one satellite at a time.</Banner>}
      <div className="plan-filters" role="group" aria-label="Filters">
        {chip('Planned only', f.plannedOnly, () => setF({ ...f, plannedOnly: !f.plannedOnly }))}
        {chip('Great only', f.greatOnly, () => setF({ ...f, greatOnly: !f.greatOnly }))}
        {station.hours && chip('In my hours', f.inMyHours, () => setF({ ...f, inMyHours: !f.inMyHours }))}
        {modes.map((m) =>
          chip(m, f.modes.has(m), () => {
            const next = new Set(f.modes);
            if (next.has(m)) next.delete(m);
            else next.add(m);
            setF({ ...f, modes: next });
          }),
        )}
      </div>
      <Button disabled={plannedItems.length === 0} onClick={() => void exportPlannedToCalendar(plannedItems, now, toV1Station(station))}>
        <Icon name="calendar" />
        Add {plannedItems.length || ''} planned to calendar
      </Button>

      {passes === null && !error && <p className="muted">Working out the week…</p>}
      {passes !== null && days.length === 0 && <p className="muted">No passes match these filters this week.</p>}
      {days.map((d) => (
        <Day key={d.start} start={d.start} location={location}>
          <DayRows
            rows={d.rows}
            isPlanned={(x) => planned.has(id(x.pass))}
            render={(x) => (
              <PassRow
                key={id(x.pass)}
                facts={x}
                now={now}
                planned={planned.has(id(x.pass))}
                clash={clashes.has(id(x.pass))}
                dim={!inHours(x.pass.aos, station.hours)}
                onTogglePlan={() => toggle(x.pass)}
              />
            )}
          />
        </Day>
      ))}
    </div>
  );
}

function Day({ start, location, children }: { start: number; location: Location; children: ReactNode }) {
  const sun = useMemo(() => sunEvents(start, start + DAY, location.latDeg, location.lonDeg), [start, location.latDeg, location.lonDeg]);
  const rise = sun.find((e) => e.kind === 'rise');
  const set = sun.find((e) => e.kind === 'set');
  const label = `${formatLocalDay(start)} ${new Date(start).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}`;
  return (
    <section className="pass-group" aria-label={label}>
      <div className="plan-day-head">
        <h2 className="pass-group-title">{label}</h2>
        <span className="plan-sun mono">
          {rise && `☀↑ ${formatLocalTimeShort(rise.t)}`} {set && `☀↓ ${formatLocalTimeShort(set.t)}`}
        </span>
      </div>
      {children}
    </section>
  );
}

/** Planned and fair-or-better passes first, up to DAY_ROWS; low passes fold into one line. */
function DayRows({ rows, isPlanned, render }: { rows: PassFacts[]; isPlanned: (x: PassFacts) => boolean; render: (x: PassFacts) => ReactNode }) {
  const [showLow, setShowLow] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const main = rows.filter((x) => isPlanned(x) || x.quality !== 'low');
  const low = rows.filter((x) => !isPlanned(x) && x.quality === 'low');
  const visible = showAll ? main : main.slice(0, DAY_ROWS);
  return (
    <>
      <ul className="pass-rows">
        {visible.map(render)}
        {showLow && low.map(render)}
      </ul>
      {main.length > visible.length && (
        <button type="button" className="pass-low" onClick={() => setShowAll(true)}>
          Show {main.length - visible.length} more
        </button>
      )}
      {low.length > 0 && (
        <button type="button" className="pass-low" aria-expanded={showLow} onClick={() => setShowLow((v) => !v)}>
          {showLow ? 'Hide low passes' : `${low.length} low ${low.length === 1 ? 'pass' : 'passes'}`}
        </button>
      )}
    </>
  );
}
