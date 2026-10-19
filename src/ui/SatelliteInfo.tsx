// Everything Passband knows about one satellite: what it's for, whether people are hearing it,
// your own contacts through it, its transmitters, its orbit and when it's next overhead.

import { useState } from 'react';
import { ACTIVITIES, activities } from '../model/activity';
import { elementAgeLevel, formatElementAge } from '../model/elementAge';
import { formatMHz, formatTone } from '../model/freq';
import { compassPoint, formatAgo, formatCountdown, formatLocalDay, formatLocalTime } from '../model/format';
import { grid4 } from '../model/grid';
import { orbitSummary } from '../model/orbit';
import type { Location, Pass, QsoRecord, Satellite, Station, StatusReport, Transmitter } from '../model/types';
import { formatDistance } from '../model/units';
import { DifficultyBadge, StatusBadge } from './badges';
import { Button, Panel, SectionTitle, Sheet, Tag } from './common';

const KIND: Record<Transmitter['kind'], string> = {
  fm_repeater: 'FM repeater',
  linear_transponder: 'Linear transponder',
  digipeater: 'Digipeater',
  beacon: 'Beacon',
  other: 'Other',
};

const REPORT: Record<StatusReport['kind'], { text: string; tone: 'ok' | 'danger' | 'plain' }> = {
  heard: { text: 'Heard', tone: 'ok' },
  crew_active: { text: 'Crew active', tone: 'ok' },
  telemetry_only: { text: 'Telemetry only', tone: 'plain' },
  not_heard: { text: 'Not heard', tone: 'danger' },
  other: { text: 'Other', tone: 'plain' },
};

const SHOWN_REPORTS = 6;
const SHOWN_PASSES = 5;
const SHOWN_QSOS = 5;

export function SatelliteInfo({
  sat,
  location,
  station,
  now,
  passes,
  qsos,
  onPick,
  onClose,
}: {
  sat: Satellite;
  location: Location;
  station: Station;
  now: number;
  /** Upcoming passes of this satellite from the active location. */
  passes: Pass[];
  qsos: QsoRecord[];
  onPick: (p: Pass) => void;
  onClose: () => void;
}) {
  const acts = activities(sat);
  const orbit = orbitSummary(sat.elements);
  const mine = qsos.filter((q) => q.satNoradId === sat.noradId);
  const myGrids = new Set(mine.filter((q) => q.gridsquare).map((q) => grid4(q.gridsquare!)));

  return (
    <Sheet title={sat.name} onClose={onClose}>
      <div className="stack">
        <Panel>
          <div className="lcd">
            <div className="lcd-line lcd-label">
              <span>NORAD {sat.noradId}</span>
              <span>
                <StatusBadge status={sat.status} /> <DifficultyBadge sat={sat} />
              </span>
            </div>
            <h2 className="readout readout-l" style={{ marginTop: 6 }}>
              {sat.name}
            </h2>
            <p className="lcd-note" style={{ fontSize: 15 }}>
              {ACTIVITIES.filter((a) => acts.has(a.id))
                .map((a) => a.label)
                .join(' · ') || 'Unknown'}
            </p>
          </div>
        </Panel>

        {sat.overlay.note ? (
          <p>{sat.overlay.note}</p>
        ) : (
          <p className="hint">
            {sat.overlay.curated
              ? 'No notes for this satellite yet.'
              : 'Nobody has written up this satellite for Passband yet. Its details below come from SatNOGS; difficulty and LoTW name are Unknown.'}
          </p>
        )}

        <Reports sat={sat} now={now} />

        <section aria-label="Your contacts">
          <SectionTitle>Your contacts</SectionTitle>
          {mine.length === 0 ? (
            <p className="hint">You haven’t logged a contact through {sat.name} yet.</p>
          ) : (
            <>
              <p>
                {mine.length} contact{mine.length === 1 ? '' : 's'}
                {myGrids.size > 0 && `, ${myGrids.size} grid${myGrids.size === 1 ? '' : 's'}`}. Last{' '}
                {formatAgo(now - mine[0]!.timeOn)}.
              </p>
              <Panel>
                <ul className="rows">
                  {mine.slice(0, SHOWN_QSOS).map((q) => (
                    <li key={q.id} className="row">
                      <span className="row-main tabular">
                        <span className="row-title row-mem" style={{ display: 'block' }}>
                          {q.call}
                          {q.gridsquare && <span className="muted"> · {grid4(q.gridsquare)}</span>}
                        </span>
                        <span className="row-sub">
                          {formatLocalDay(q.timeOn)} {formatLocalTime(q.timeOn)} · {q.mode}
                        </span>
                      </span>
                    </li>
                  ))}
                </ul>
              </Panel>
            </>
          )}
        </section>

        <section aria-label="Next passes">
          <SectionTitle>Next passes from {location.name}</SectionTitle>
          {passes.length === 0 ? (
            <p className="hint">No passes in the next 24 hours.</p>
          ) : (
            <Panel>
              <ul className="rows">
                {passes.slice(0, SHOWN_PASSES).map((p) => (
                  <li key={p.aos}>
                    <button
                      type="button"
                      className="row"
                      onClick={() => onPick(p)}
                      aria-label={`Show the ${formatLocalTime(p.aos)} pass`}
                    >
                      <span className="row-main tabular">
                        <span className="row-title" style={{ display: 'block' }}>
                          {elementAgeLevel(p.elementsEpoch, now) === 'stale' && '~'}
                          {formatLocalDay(p.aos)} {formatLocalTime(p.aos)}
                        </span>
                        <span className="row-sub">
                          up to {Math.round(p.maxElDeg)}° · {compassPoint(p.aosAzDeg)}→{compassPoint(p.losAzDeg)}
                        </span>
                      </span>
                      <span className="row-end">{now >= p.aos ? 'up now' : formatCountdown(p.aos - now).replace('in ', '')}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </Panel>
          )}
        </section>

        <section aria-label="Transmitters">
          <SectionTitle>Transmitters</SectionTitle>
          <Panel>
            <ul className="rows">
              {sat.transmitters.map((t) => (
                <li key={t.id} className="row" style={{ alignItems: 'flex-start' }}>
                  <span className="row-main">
                    <span className="row-title" style={{ display: 'block' }}>
                      {t.description || KIND[t.kind]}
                    </span>
                    <span className="row-sub" style={{ display: 'block' }}>
                      {KIND[t.kind]} · {t.mode}
                      {t.kind === 'linear_transponder' && (t.inverting ? ' · inverting' : t.inverting === false ? ' · non-inverting' : '')}
                    </span>
                    <span className="mono" style={{ display: 'block', marginTop: 4 }}>
                      {t.downlinkHz !== null && <>↓ {freqRange(t.downlinkHz, t.downlinkHighHz)} </>}
                      {t.uplinkHz !== null && <>↑ {freqRange(t.uplinkHz, t.uplinkHighHz)} </>}
                      {t.uplinkHz !== null && (
                        <span style={{ fontStyle: t.ctcssHz === 'unknown' ? 'italic' : undefined }}>· tone {formatTone(t.ctcssHz)}</span>
                      )}
                    </span>
                  </span>
                  <Tag tone={t.status === 'active' ? 'ok' : t.status === 'inactive' ? 'danger' : 'warn'}>
                    {t.status === 'active' ? 'Active' : t.status === 'inactive' ? 'Inactive' : 'Unknown'}
                  </Tag>
                </li>
              ))}
            </ul>
          </Panel>
        </section>

        <section aria-label="Orbit">
          <SectionTitle>Orbit</SectionTitle>
          <Panel>
            <dl className="facts">
              {orbit && (
                <>
                  <dt>Height</dt>
                  <dd>
                    {Math.abs(orbit.apogeeM - orbit.perigeeM) < 20_000
                      ? `about ${formatDistance((orbit.perigeeM + orbit.apogeeM) / 2, station.units)}`
                      : `${formatDistance(orbit.perigeeM, station.units)} to ${formatDistance(orbit.apogeeM, station.units)}`}
                  </dd>
                  <dt>Once round</dt>
                  <dd>{Math.round(orbit.periodS / 60)} min</dd>
                  <dt>Inclination</dt>
                  <dd>{orbit.inclinationDeg.toFixed(1)}°</dd>
                </>
              )}
              <dt>Elements</dt>
              <dd>
                {formatElementAge(sat.elementsEpoch, now)}, from {sat.elementsSource === 'celestrak-omm' ? 'CelesTrak' : 'SatNOGS'}
              </dd>
              <dt>LoTW name</dt>
              <dd>{sat.lotwName ?? (sat.overlay.curated ? 'Not on LoTW' : 'Unknown')}</dd>
            </dl>
          </Panel>
        </section>

        <p className="hint">
          More: <a href={`https://db.satnogs.org/search/?q=${sat.noradId}`} target="_blank" rel="noreferrer">SatNOGS</a>
          {sat.reports && (
            <>
              {' · '}
              <a href="https://www.amsat.org/status/" target="_blank" rel="noreferrer">
                AMSAT status
              </a>
            </>
          )}
        </p>
      </div>
    </Sheet>
  );
}

function freqRange(lo: number, hi: number | null): string {
  return hi !== null && hi !== lo ? `${formatMHz(lo)}–${formatMHz(hi)}` : formatMHz(lo);
}

/** Recent reports from the AMSAT status page, as of the last catalog build (D4). */
function Reports({ sat, now }: { sat: Satellite; now: number }) {
  const [all, setAll] = useState(false);
  const r = sat.reports;
  return (
    <section aria-label="Recent reports">
      <SectionTitle>On the air lately</SectionTitle>
      {!r ? (
        <p className="hint">AMSAT doesn’t collect reports for {sat.name}, so there’s nothing to show.</p>
      ) : r.latest === null || r.heard === null ? (
        <p className="hint">Reports were unavailable when this satellite data was published. They’ll be back after the next daily update.</p>
      ) : (
        <>
          <p>
            {r.heard > 0 ? (
              <>
                <b>Heard {r.heard} time{r.heard === 1 ? '' : 's'}</b> in {r.windowHours / 24} days
                {r.lastHeard !== null && <>, most recently {formatAgo(now - r.lastHeard)}</>}.
              </>
            ) : (
              <>
                <b>Nobody reported hearing it</b> in {r.windowHours / 24} days.
              </>
            )}
            {r.notHeard ? ` ${r.notHeard} “not heard” report${r.notHeard === 1 ? '' : 's'}.` : ''}
          </p>
          {r.latest.length > 0 && (
            <Panel>
              <ul className="rows">
                {(all ? r.latest : r.latest.slice(0, SHOWN_REPORTS)).map((x, i) => (
                  <li key={`${x.t}-${x.callsign}-${i}`} className="row">
                    <span className="row-main tabular">
                      <span className="row-title mono" style={{ display: 'block' }}>
                        {x.callsign}
                        {x.grid && <span className="muted"> · {grid4(x.grid)}</span>}
                      </span>
                      <span className="row-sub">
                        {formatAgo(now - x.t)} · {x.mode.replace(/_/g, ' ')}
                      </span>
                    </span>
                    <Tag tone={REPORT[x.kind].tone}>{REPORT[x.kind].text}</Tag>
                  </li>
                ))}
              </ul>
            </Panel>
          )}
          {r.latest.length > SHOWN_REPORTS && (
            <Button kind="ghost" onClick={() => setAll((a) => !a)}>
              {all ? 'Fewer reports' : `All ${r.latest.length} recent reports`}
            </Button>
          )}
          <p className="hint">From the AMSAT status page, collected {formatAgo(now - r.fetchedAt)}. Updated once a day.</p>
        </>
      )}
    </section>
  );
}
