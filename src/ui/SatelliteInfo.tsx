// A satellite's profile: what it is and who sent it up, what's on board and how to work it,
// whether people are hearing it, when it's next overhead, and your own contacts through it.

import { useState } from 'react';
import { ACTIVITIES, activities } from '../model/activity';
import { elementAgeLevel, formatElementAge } from '../model/elementAge';
import { compassPoint, formatAgo, formatCountdown, formatLocalDay, formatLocalTime } from '../model/format';
import { footprintRadiusM } from '../model/footprint';
import { grid4 } from '../model/grid';
import { gearFor } from '../model/modes';
import { orbitSummary } from '../model/orbit';
import { YEAR } from '../model/time';
import { primaryTransmitter } from '../model/transmitters';
import { operatorPreferences } from '../model/operator';
import type { Location, Pass, QsoRecord, Satellite, Station, StatusReport, Transmitter } from '../model/types';
import { formatDistance, formatSpeed } from '../model/units';
import { ActivityChart } from './ActivityChart';
import { DifficultyBadge, StatusBadge } from './badges';
import { Button, Fold, Panel, SectionTitle, Tag } from './common';
import { FavoriteKey } from './FavoriteKey';
import { RadioSetup } from './RadioSetup';

const REPORT: Record<StatusReport['kind'], { text: string; tone: 'ok' | 'danger' | 'plain' }> = {
  heard: { text: 'Heard', tone: 'ok' },
  crew_active: { text: 'Crew active', tone: 'ok' },
  telemetry_only: { text: 'Telemetry', tone: 'plain' },
  not_heard: { text: 'Not heard', tone: 'danger' },
  other: { text: 'Other', tone: 'plain' },
};

const SHOWN_REPORTS = 3;
/** Transmitters shown before the rest fold away: the ISS lists more than a dozen. */
const SHOWN_ON_BOARD = 3;

/** "158,000": a lap count to a precision the elements can honestly give. */
function roundLaps(n: number): string {
  const step = n >= 10_000 ? 1000 : n >= 1000 ? 100 : 1;
  return (Math.round(n / step) * step).toLocaleString();
}

const KIND_RANK: Record<Transmitter['kind'], number> = { fm_repeater: 0, linear_transponder: 1, digipeater: 2, other: 3, beacon: 4 };
const SHOWN_PASSES = 4;
const SHOWN_QSOS = 5;

/** "Japan", from "JP": the browser's own region names, or the code where it has none. */
function countryName(code: string): string {
  try {
    return new Intl.DisplayNames(['en'], { type: 'region' }).of(code) ?? code;
  } catch {
    return code;
  }
}

/** The flag emoji for a two-letter region code. */
function flag(code: string): string {
  return String.fromCodePoint(...[...code].map((c) => 0x1f1e6 + c.charCodeAt(0) - 65));
}

/** SPEC-v2's satellite page (§6.5): who it is, what's on board, how it's been heard, its passes. */
export function SatelliteProfile({
  sat,
  location,
  station,
  now,
  passes,
  qsos,
  onPick,
  favorite,
  onFavorite,
}: {
  sat: Satellite;
  location: Location;
  station: Station;
  now: number;
  /** Upcoming passes of this satellite from the active location. */
  passes: Pass[];
  qsos: QsoRecord[];
  onPick: (p: Pass) => void;
  favorite: boolean;
  onFavorite: () => void;
}) {
  const acts = activities(sat);
  const orbit = orbitSummary(sat.elements);
  const about = sat.about;
  const profile = sat.overlay.profile ?? null;
  // What you can talk through first, then what you can only listen to.
  const working = sat.transmitters
    .filter((t) => t.status !== 'inactive')
    .sort((a, b) => Number(b.uplinkHz !== null) - Number(a.uplinkHz !== null) || KIND_RANK[a.kind] - KIND_RANK[b.kind]);
  const [allOnBoard, setAllOnBoard] = useState(false);
  const dead = sat.transmitters.filter((t) => t.status === 'inactive');
  const primary = primaryTransmitter(sat);
  const mine = qsos.filter((q) => q.satNoradId === sat.noradId);
  const myGrids = new Set(mine.filter((q) => q.gridsquare).map((q) => grid4(q.gridsquare!)));
  const [photoOk, setPhotoOk] = useState(true);
  const years = about?.launched ? (now - about.launched) / YEAR : null;
  const meanAlt = orbit ? (orbit.perigeeM + orbit.apogeeM) / 2 : null;

  return (
    <div className="stack profile">
        {/* Who it is */}
        <Panel className="profile-hero">
          {about?.image && photoOk && (
            <img
              className="profile-photo"
              src={`${import.meta.env.BASE_URL}${about.image}`}
              alt={`${sat.name}, as photographed or drawn by its team`}
              onError={() => setPhotoOk(false)}
            />
          )}
          <div className="lcd">
            <div className="lcd-line lcd-label">
              <span>
                {about?.countries.map(flag).join(' ')} NORAD {sat.noradId}
              </span>
              <span>
                <StatusBadge status={sat.status} /> <DifficultyBadge sat={sat} />
              </span>
            </div>
            <div className="lcd-line" style={{ marginTop: 6 }}>
              <h2 className="readout readout-l">{sat.name}</h2>
              <FavoriteKey name={sat.name} on={favorite} onToggle={onFavorite} />
            </div>
            {about && about.alsoKnownAs.length > 0 && <p className="lcd-label">Also {about.alsoKnownAs.slice(0, 3).join(' · ')}</p>}
            <p className="lcd-note" style={{ fontSize: 15 }}>
              {ACTIVITIES.filter((a) => acts.has(a.id))
                .map((a) => a.label)
                .join(' · ') || 'Unknown'}
            </p>
          </div>
        </Panel>

        {profile ? (
          <p className="profile-story">{profile.story}</p>
        ) : (
          <p className="hint">
            Nobody has written this satellite up for Passband yet, so there’s no story and its difficulty is Unknown. The facts
            below come from SatNOGS.
          </p>
        )}

        {/* At a glance */}
        <section aria-label="At a glance">
          <SectionTitle>At a glance</SectionTitle>
          <Panel>
            <dl className="facts">
              {profile && (
                <>
                  <dt>Built by</dt>
                  <dd>{profile.builtBy}</dd>
                </>
              )}
              <dt>Launched</dt>
              <dd>
                {about?.launched
                  ? new Date(about.launched).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' })
                  : 'Unknown'}
                {profile?.launch && <span className="facts-sub">{profile.launch}</span>}
              </dd>
              {about && about.countries.length > 0 && (
                <>
                  <dt>From</dt>
                  <dd>{about.countries.map(countryName).join(', ')}</dd>
                </>
              )}
              {years !== null && years >= 1 && (
                <>
                  <dt>In orbit</dt>
                  <dd>{Math.floor(years)} years</dd>
                </>
              )}
              {orbit && meanAlt !== null && (
                <>
                  <dt>Height</dt>
                  <dd>
                    {orbit.apogeeM - orbit.perigeeM < 40_000
                      ? `about ${formatDistance(meanAlt, station.units)}`
                      : `${formatDistance(orbit.perigeeM, station.units)} to ${formatDistance(orbit.apogeeM, station.units)}`}
                  </dd>
                  <dt>Speed</dt>
                  <dd>{formatSpeed(orbit.speedMps, station.units)}</dd>
                  <dt>Laps of Earth</dt>
                  <dd>
                    {orbit.revsPerDay.toFixed(1)} a day, {Math.round(orbit.periodS / 60)} min each
                    {about?.launched && (
                      <span className="facts-sub">
                        About {roundLaps((now - about.launched) / (orbit.periodS * 1000))} since launch
                      </span>
                    )}
                  </dd>
                  <dt>Sees at once</dt>
                  <dd>{formatDistance(2 * footprintRadiusM(meanAlt), station.units)} across</dd>
                  <dt>Inclination</dt>
                  <dd>{orbit.inclinationDeg.toFixed(1)}°</dd>
                </>
              )}
            </dl>
          </Panel>
        </section>

        {/* What's on board */}
        <section aria-label="On board">
          <SectionTitle>On board</SectionTitle>
          <div className="stack">
            {working.length === 0 && <p className="hint">No working transmitters are listed.</p>}
            {(allOnBoard ? working : working.slice(0, SHOWN_ON_BOARD)).map((t) => (
              <Panel key={t.id}>
                <div className="lcd">
                  {t.description && <p className="lcd-label" style={{ marginBottom: 6, textTransform: 'none' }}>{t.description}</p>}
                  <RadioSetup tx={t} size="small" />
                  {t.status === 'unknown' && <p className="lcd-note">Status Unknown: nobody has confirmed it’s working.</p>}
                </div>
              </Panel>
            ))}
            {working.length > SHOWN_ON_BOARD && (
              <Button kind="ghost" onClick={() => setAllOnBoard((a) => !a)}>
                {allOnBoard ? 'Fewer' : `${working.length - SHOWN_ON_BOARD} more transmitters`}
              </Button>
            )}
            {dead.length > 0 && (
              <Fold title={`Not working (${dead.length})`}>
                <ul className="rows">
                  {dead.map((t) => (
                    <li key={t.id} className="row">
                      <span className="row-main">
                        <span className="row-title" style={{ display: 'block' }}>
                          {t.description || t.mode}
                        </span>
                        <span className="row-sub">{t.mode}</span>
                      </span>
                      <Tag tone="danger">Inactive</Tag>
                    </li>
                  ))}
                </ul>
              </Fold>
            )}
            {primary && operatorPreferences(station).tips && (
              <p>
                <b>What you’ll need:</b> <span className="muted">{gearFor(primary)}</span>
              </p>
            )}
          </div>
        </section>

        <Activity sat={sat} now={now} />

        <section aria-label="Next passes">
          <SectionTitle>Next passes from {location.name}</SectionTitle>
          {passes.length === 0 ? (
            <p className="hint">No passes in the next 24 hours.</p>
          ) : (
            <Panel>
              <ul className="rows">
                {passes.slice(0, SHOWN_PASSES).map((p) => (
                  <li key={p.aos}>
                    <button type="button" className="row" onClick={() => onPick(p)} aria-label={`Show the ${formatLocalTime(p.aos)} pass`}>
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

        <section aria-label="Your contacts">
          <SectionTitle>Your contacts</SectionTitle>
          {mine.length === 0 ? (
            <p className="hint">You haven’t logged a contact through {sat.name} yet.</p>
          ) : (
            <>
              <p>
                {mine.length} contact{mine.length === 1 ? '' : 's'}
                {myGrids.size > 0 && `, ${myGrids.size} grid${myGrids.size === 1 ? '' : 's'}`}. Last {formatAgo(now - mine[0]!.timeOn)}.
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

        <section aria-label="Sources" className="hint">
          <p>
            Orbit from {sat.elementsSource === 'celestrak-omm' ? 'CelesTrak' : 'SatNOGS'}, elements {formatElementAge(sat.elementsEpoch, now)}.
            Transmitters and background from SatNOGS{sat.reports ? '; reports from AMSAT' : ''}.
            {profile && ` Profile: ${profile.source}.`} LoTW name: {sat.lotwName ?? (sat.overlay.curated ? 'not on LoTW' : 'Unknown')}.
          </p>
          <p style={{ marginTop: 6 }}>
            <a href={`https://db.satnogs.org/search/?q=${sat.noradId}`} target="_blank" rel="noopener noreferrer">
              {sat.name} on SatNOGS
            </a>
            {about?.website && (
              <>
                {' · '}
                <a href={about.website} target="_blank" rel="noopener noreferrer">
                  The team’s site
                </a>
              </>
            )}
          </p>
        </section>
    </div>
  );
}

/** Is anyone hearing it? The 14-day graph, then the latest few reports. */
function Activity({ sat, now }: { sat: Satellite; now: number }) {
  const [all, setAll] = useState(false);
  const r = sat.reports;
  return (
    <section aria-label="Activity">
      <SectionTitle>Activity</SectionTitle>
      {!r ? (
        <p className="hint">AMSAT doesn’t collect reports for {sat.name}, so there’s no activity to show.</p>
      ) : r.latest === null || r.heard === null ? (
        <p className="hint">Reports were unavailable when this satellite data was published. They’ll be back after the next daily update.</p>
      ) : (
        <div className="stack">
          <p>
            {r.lastHeard !== null ? (
              <>
                <b>Last heard {formatAgo(now - r.lastHeard)}</b>.{' '}
              </>
            ) : (
              <>
                <b>Nobody reported hearing it</b> in the last {r.windowHours / 24} days.{' '}
              </>
            )}
            <span className="muted">
              {r.heard} heard, {r.notHeard} not heard in {r.windowHours / 24} days.
            </span>
          </p>
          {r.daily && r.daily.length > 1 && <ActivityChart days={r.daily} />}
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
          <p className="hint">From the AMSAT status page, collected {formatAgo(now - r.fetchedAt)}.</p>
        </div>
      )}
    </section>
  );
}
