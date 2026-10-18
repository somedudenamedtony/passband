import { useEffect, useState } from 'react';
import { downlinkHeardHz, fmTuning, type FmTuning } from '../model/doppler';
import { elementAgeLevel, formatElementAge } from '../model/elementAge';
import { formatMHz, formatOffsetKHz, formatTone } from '../model/freq';
import {
  compassPoint,
  compassWord,
  formatCountdown,
  formatClock,
  formatDuration,
  formatLocalDay,
  formatLocalTime,
  formatUtc,
} from '../model/format';
import { primaryTransmitter } from '../model/transmitters';
import type { Location, Pass, Satellite, Station, Transmitter } from '../model/types';
import { predictPasses, rangeRateAt } from '../predict/client';
import { isGoodPass } from '../model/selection';
import { DAY } from '../model/time';
import { exportPassesToCalendar } from './calendar';
import { createCue } from '../cue/cue';
import { Banner, Button, Panel } from './common';
import { Icon } from './icons';
import { DifficultyBadge, StatusBadge } from './badges';

interface Doppler {
  tuning: FmTuning | null;
  /** Downlink shift AOS → LOS in Hz (experienced card). */
  spanHz: number | null;
}

function useDoppler(pass: Pass, sat: Satellite, tx: Transmitter | null, location: Location, station: Station, now: number): Doppler | null {
  const [d, setD] = useState<Doppler | null>(null);
  // Re-evaluate once a pass is under way so the start frequency follows the satellite.
  const startAt = Math.max(pass.aos, Math.min(now, pass.los));
  const bucket = Math.floor(startAt / 30_000);
  useEffect(() => {
    if (!tx) {
      setD(null);
      return;
    }
    let cancelled = false;
    void (async () => {
      const [rrStart, rrAos, rrLos] = await Promise.all([
        rangeRateAt(sat, location, bucket * 30_000),
        rangeRateAt(sat, location, pass.aos),
        rangeRateAt(sat, location, pass.los),
      ]);
      if (cancelled) return;
      const tuning = tx.kind === 'fm_repeater' && rrStart !== null ? fmTuning(tx, rrStart, station.radioStepHz) : null;
      const spanHz =
        tx.downlinkHz !== null && rrAos !== null && rrLos !== null
          ? downlinkHeardHz(tx.downlinkHz, rrLos) - downlinkHeardHz(tx.downlinkHz, rrAos)
          : null;
      setD({ tuning, spanHz });
    })();
    return () => {
      cancelled = true;
    };
  }, [tx, sat, location, pass.aos, pass.los, station.radioStepHz, bucket]);
  return d;
}

function gearHint(tx: Transmitter): string {
  switch (tx.kind) {
    case 'fm_repeater':
      return 'An FM handheld or mobile radio that covers both bands. A hand-held directional antenna makes a big difference.';
    case 'linear_transponder':
      return 'An SSB/CW radio (or two) able to transmit and receive at the same time, and a directional antenna.';
    case 'digipeater':
      return 'A radio that can send packets, or a radio plus a phone app or TNC.';
    case 'beacon':
      return 'Receive only: any radio or SDR that covers the downlink.';
    default:
      return 'Check the transmitter details before the pass.';
  }
}

export function PassCard({
  pass,
  sat,
  location,
  station,
  now,
  isNext,
  onBackToNext,
  onStart,
}: {
  pass: Pass;
  sat: Satellite;
  location: Location;
  station: Station;
  now: number;
  isNext: boolean;
  onBackToNext?: () => void;
  onStart: () => void;
}) {
  const tx = primaryTransmitter(sat);
  const doppler = useDoppler(pass, sat, tx, location, station, now);
  const inProgress = now >= pass.aos && now < pass.los;
  const durationS = Math.round((pass.los - pass.aos) / 1000);
  const masked = pass.visibleSecondsAboveMask < durationS - 30;
  const age = elementAgeLevel(pass.elementsEpoch, now);
  const approx = age === 'stale';
  const isNew = station.experience === 'new';
  const tilde = approx ? '~' : '';

  const bars = Math.max(1, Math.round(pass.maxElDeg / 9));

  return (
    <Panel label={`Pass of ${sat.name}`}>
      <div className="lcd">
        <div className="lcd-line lcd-label">
          <span>{isNext ? 'Next good pass' : 'Selected pass'}</span>
          <span>
            <StatusBadge status={sat.status} /> <DifficultyBadge sat={sat} />
          </span>
        </div>
        <div className="lcd-line" style={{ marginTop: 6 }}>
          <h2 className="readout readout-l" style={{ fontWeight: 400 }}>
            {sat.name}
          </h2>
        </div>
        <div className="readout readout-m" style={{ marginTop: 6 }}>
          {inProgress ? <>Up now · sets in {formatClock(pass.los - now)}</> : <>Rises {tilde}{formatCountdown(pass.aos - now)}</>}
        </div>
        <p className="lcd-label" style={{ marginTop: 4, textTransform: 'none' }}>
          {formatLocalDay(pass.aos)} {tilde}
          {formatLocalTime(pass.aos)}–{formatLocalTime(pass.los)} · {formatUtc(pass.aos)}
        </p>

        {tx && (
          <>
            <hr className="lcd-rule" />
            <Frequencies tx={tx} doppler={doppler} inProgress={inProgress} isNew={isNew} />
          </>
        )}

        <hr className="lcd-rule" />
        <div className="lcd-line">
          <span>
            <span className="lcd-label">Highest </span>
            <span className="readout readout-s">{Math.round(pass.maxElDeg)}°</span>
          </span>
          <span>
            <span className="lcd-label">Duration </span>
            <span className="readout readout-s">{formatDuration(durationS)}</span>
          </span>
        </div>
        <div className="bargraph" aria-hidden>
          {Array.from({ length: 10 }, (_, i) => (
            <span key={i} className={i < bars ? 'on' : undefined} />
          ))}
        </div>
        <div className="lcd-line lcd-label" style={{ fontSize: 11, marginTop: 4 }} aria-hidden>
          <span>0°</span>
          <span>90°</span>
        </div>

        {!isNew && (
          <div className="tabular" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginTop: 10 }}>
            <div>
              <div className="lcd-label">AOS</div>
              <div>{formatUtc(pass.aos, true)}</div>
            </div>
            <div>
              <div className="lcd-label">TCA</div>
              <div>{formatUtc(pass.tca, true)}</div>
            </div>
            <div>
              <div className="lcd-label">LOS</div>
              <div>{formatUtc(pass.los, true)}</div>
            </div>
            {doppler?.spanHz != null && (
              <div style={{ gridColumn: 'span 3' }}>
                <span className="lcd-label">Downlink Doppler, AOS → LOS: </span>
                {formatOffsetKHz(doppler.spanHz)}
              </div>
            )}
          </div>
        )}
      </div>

      <div className="stack" style={{ marginTop: 12 }}>
        {!isNew && (
          <p className="silk" style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
            <span>
              AOS {Math.round(pass.aosAzDeg)}° {compassPoint(pass.aosAzDeg)}
            </span>
            <span>
              LOS {Math.round(pass.losAzDeg)}° {compassPoint(pass.losAzDeg)}
            </span>
          </p>
        )}
        {isNew && (
          <p>
            Rises in the <b>{compassWord(pass.aosAzDeg)}</b>, sets in the <b>{compassWord(pass.losAzDeg)}</b>.
          </p>
        )}

        {masked && <p style={{ fontWeight: 700 }}>Only {formatDuration(pass.visibleSecondsAboveMask)} above your horizon mask.</p>}

        {isNew && sat.overlay.note && <p>{sat.overlay.note}</p>}
        {isNew && tx && (
          <p className="muted">
            <b style={{ color: 'var(--ink)' }}>You’ll need:</b> {gearHint(tx)}
          </p>
        )}

        <p className={age === 'fresh' ? 'hint' : undefined} style={{ fontWeight: age === 'fresh' ? undefined : 700 }}>
          Elements {formatElementAge(pass.elementsEpoch, now)}
          {approx && ' — times are approximate'}
        </p>
        {onBackToNext && !isNext && (
          <Button kind="ghost" onClick={onBackToNext}>
            Back to next
          </Button>
        )}
        <Button
          kind="primary"
          size="large"
          onClick={() => {
            // The tap is the user gesture browsers need before cues can make a sound (D14).
            createCue(station.cues).unlock();
            onStart();
          }}
        >
          <Icon name="play" />
          {inProgress ? 'Track it now' : 'Start'}
        </Button>
        <Reminders pass={pass} sat={sat} location={location} station={station} now={now} />
        {approx && (
          <Banner tone="danger">These elements are over two weeks old. The satellite may be minutes away from where this says.</Banner>
        )}
      </div>
    </Panel>
  );
}

function Frequencies({ tx, doppler, inProgress, isNew }: { tx: Transmitter; doppler: Doppler | null; inProgress: boolean; isNew: boolean }) {
  const t = doppler?.tuning;
  const when = inProgress ? 'now' : 'at rise';
  if (tx.kind === 'fm_repeater') {
    const down = t?.downlinkHz ?? tx.downlinkHz;
    const up = t?.uplinkHz ?? tx.uplinkHz;
    return (
      <div>
        {down !== null && (
          <div className="lcd-line">
            <span className="lcd-label">↓ Listen {t?.tuneSide === 'downlink' ? when : ''}</span>
            <span className="readout readout-l">{formatMHz(down)}</span>
          </div>
        )}
        {up !== null && (
          <div className="lcd-line">
            <span className="lcd-label">↑ Transmit {t?.tuneSide === 'uplink' ? when : ''}</span>
            <span className="readout readout-l">{formatMHz(up)}</span>
          </div>
        )}
        <div className="lcd-line" style={{ marginTop: 6 }}>
          <span className="lcd-label">Tone</span>
          <span className="readout readout-s" style={{ fontStyle: tx.ctcssHz === 'unknown' ? 'italic' : undefined }}>
            {formatTone(tx.ctcssHz)}
          </span>
        </div>
        {isNew && t?.tuneSide && (
          <p className="lcd-note">
            Leave the {t.tuneSide === 'downlink' ? 'transmit' : 'listen'} frequency alone and retune the{' '}
            {t.tuneSide === 'downlink' ? 'listen' : 'transmit'} side as the satellite passes.
          </p>
        )}
      </div>
    );
  }
  const range = (lo: number | null, hi: number | null) =>
    lo === null ? null : hi !== null && hi !== lo ? `${formatMHz(lo)}–${formatMHz(hi)}` : formatMHz(lo);
  const down = range(tx.downlinkHz, tx.downlinkHighHz);
  const up = range(tx.uplinkHz, tx.uplinkHighHz);
  return (
    <div>
      <p className="lcd-label">
        {tx.mode} {tx.kind === 'linear_transponder' && (tx.inverting ? '· inverting' : tx.inverting === false ? '· non-inverting' : '')}
      </p>
      {down && (
        <div className="lcd-line">
          <span className="lcd-label">↓</span>
          <span className="readout readout-s">{down}</span>
        </div>
      )}
      {up && (
        <div className="lcd-line">
          <span className="lcd-label">↑</span>
          <span className="readout readout-s">{up}</span>
        </div>
      )}
    </div>
  );
}

/** D17: the phone's own calendar does the reminding — one pass, or the week's good ones. */
function Reminders({ pass, sat, location, station, now }: { pass: Pass; sat: Satellite; location: Location; station: Station; now: number }) {
  const [busy, setBusy] = useState(false);
  return (
    <div className="key-row">
      <Button onClick={() => void exportPassesToCalendar([pass], sat, now, `${sat.name}-${formatLocalTime(pass.aos).replace(/\W/g, '')}`)}>
        <Icon name="calendar" />
        Remind me
      </Button>
      <Button
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          try {
            const week = await predictPasses([sat], location, now, now + 7 * DAY);
            const good = week.filter((p) => p.aos > now && isGoodPass(p, station.experience));
            if (good.length) await exportPassesToCalendar(good, sat, now, `${sat.name}-this-week`);
            else alert(`No good ${sat.name} passes in the next week.`);
          } finally {
            setBusy(false);
          }
        }}
      >
        {busy ? 'Working…' : 'This week'}
      </Button>
    </div>
  );
}
