// SPEC-v2 §6.2: one pass, one page, in the phase the clock says (D23). R2 builds Before and Soon:
// the track, how to set the radio, and the plan. During offers the live view (R3) and keeps the
// radio setup in reach; After and Past arrive with R3.

import { useState } from 'react';
import { Link } from '../app/Link';
import { ModeChip, OnAirMark, passFacts, QualityBar } from '../components/pass';
import { Checklist } from '../live/Checklist';
import { SkyPlot } from '../live/SkyPlot';
import { formatElementAge } from '../model/elementAge';
import { formatCountdown, formatDuration, formatLocalDay, formatLocalTime } from '../model/format';
import { parsePassId, type PassId } from '../model/passId';
import { direction, phaseOf } from '../model/passView';
import { toV1Station } from '../model/stationV2';
import { usePass, usePassTrack } from '../store/passes';
import { store, useActiveLocation, useAppState } from '../store/store';
import { exportPassesToCalendar } from '../ui/calendar';
import { useNow } from '../ui/clock';
import { Banner, Button, Panel } from '../ui/common';
import { RadioSetup } from '../ui/RadioSetup';
import { planFor } from './Now';

export function PassPage({ id }: { id: PassId }) {
  const { noradId, aosMinuteMs } = parsePassId(id)!;
  const sat = useAppState((s) => s.catalog?.catalog.satellites.find((x) => x.noradId === noradId) ?? null);
  const station = useAppState((s) => s.station);
  const plan = useAppState((s) => s.plans.find((p) => p.id === id) ?? null);
  const location = useActiveLocation();
  const { pass, error } = usePass(sat, location, id, aosMinuteMs);
  const track = usePassTrack(sat, location, pass);
  const now = useNow();
  const [note, setNote] = useState<string | null>(null);

  if (!location) return <Gone title="No location yet" text="Set where you are on Now, and this pass will be worked out for it." />;
  if (!sat || !station) return <Gone title="Unknown satellite" text={`NORAD ${noradId} isn’t in the satellite data on this device.`} />;
  if (error) return <Banner tone="danger">Couldn’t work out this pass: {error}</Banner>;
  if (pass === undefined) return <p className="muted">Working out the pass…</p>;
  if (pass === null) {
    return <Gone title={`${sat.name}: no such pass`} text={`There’s no ${sat.name} pass at ${formatLocalDay(aosMinuteMs)} ${formatLocalTime(aosMinuteMs)} from ${location.name}. Elements may have changed, or the link was for somewhere else.`} />;
  }

  const f = passFacts(pass, sat, station, now);
  const phase = phaseOf(pass, now);
  const listenOnly = station.goal === 'listen';
  const v1 = toV1Station(station);
  const going = plan !== null;

  return (
    <div className="stack">
      <section className="panel stack" aria-label={`${sat.name} pass`}>
        <div className="pass-head">
          <h1 className="screen-title">{sat.name}</h1>
          <ModeChip guide={f.guide} />
        </div>
        <p className="mono">
          {formatLocalDay(pass.aos)} {formatLocalTime(pass.aos)}–{formatLocalTime(pass.los)} · {formatDuration(Math.round((pass.los - pass.aos) / 1000))}
        </p>
        <p className="mono">
          <QualityBar q={f.quality} /> {Math.round(pass.maxElDeg)}° max · {direction(pass)}
        </p>
        <p>
          <OnAirMark outlook={f.outlook} /> {f.outlook.reason}
        </p>
        <p className={f.stale ? 'warn-text' : 'muted'}>Predicted from elements {formatElementAge(pass.elementsEpoch, now)}.</p>
      </section>

      {phase === 'during' && (
        <Panel label="Up now">
          <h2 className="lcd-label">Up now</h2>
          <p>Sets {formatCountdown(pass.los - now)}.</p>
          <Link to={{ name: 'live', passId: id }} className="key key-primary key-block">Track</Link>
        </Panel>
      )}
      {(phase === 'after' || phase === 'past') && (
        <Panel label="Ended">
          <h2 className="lcd-label">Ended</h2>
          <p>This pass ended {formatLocalTime(pass.los)}. Reviewing and logging after a pass arrive with the next rebuild step.</p>
        </Panel>
      )}

      {(phase === 'before' || phase === 'soon' || phase === 'during') && (
        <>
          {phase === 'soon' && (
            <Panel label="Starting soon" className="stack">
              <h2 className="lcd-label">Starting soon</h2>
              <p className="next-up-count mono">Rises {formatCountdown(pass.aos - now)}</p>
              <Link to={{ name: 'live', passId: id }} className="key key-primary key-block">Track</Link>
              {station.guidance === 'guided' && <Checklist pass={pass} tx={f.tx} listenOnly={listenOnly} />}
            </Panel>
          )}
          <Panel label="Sky track">
            <h2 className="lcd-label">Sky track</h2>
            <div className="pass-sky">
              <SkyPlot track={track} now={null} mask={location.horizonMask} />
            </div>
          </Panel>
          <section className="lcd" aria-labelledby="radio-h">
            <h2 id="radio-h" className="lcd-label">Set your radio</h2>
            {f.tx ? <RadioSetup tx={f.tx} isNew={station.guidance === 'guided'} listenOnly={listenOnly} /> : <p>Transmitter details are Unknown for {sat.name}.</p>}
          </section>
          {phase !== 'during' && <Panel label="Plan" className="stack">
            <h2 className="lcd-label">Plan</h2>
            <button
              type="button"
              className={`key ${going ? 'key-primary' : 'key-secondary'} key-block`}
              aria-pressed={going}
              onClick={() => void (going ? store.removePlan(id) : store.savePlan(planFor(pass, location, now)))}
            >
              {going ? '★ Going' : '☆ I’m going for this one'}
            </button>
            {plan && (
              <div className="field">
                <label htmlFor="plan-note">Note</label>
                <input
                  id="plan-note"
                  value={note ?? plan.note}
                  placeholder="Where, with whom, what to try"
                  onChange={(e) => setNote(e.target.value)}
                  onBlur={() => note !== null && void store.savePlan({ ...plan, note })}
                />
              </div>
            )}
            <Button onClick={() => void exportPassesToCalendar([pass], sat, now, `${sat.name} pass`, v1)}>Add to calendar</Button>
          </Panel>}
        </>
      )}

      <Link to={{ name: 'sat', noradId }} className="key key-ghost key-block">About {sat.name} →</Link>
    </div>
  );
}

function Gone({ title, text }: { title: string; text: string }) {
  return (
    <div className="stack">
      <h1 className="screen-title">{title}</h1>
      <p>{text}</p>
      <Link to={{ name: 'now' }} className="key key-secondary key-block">Go to Now</Link>
    </div>
  );
}
