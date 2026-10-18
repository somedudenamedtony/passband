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
import { Banner, Button } from './common';
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

  return (
    <article className="rounded-2xl border-2 border-accent bg-surface p-4" aria-label={`Pass of ${sat.name}`}>
      <div className="mb-1 flex items-center justify-between text-sm font-semibold text-muted">
        <span>{isNext ? 'Next good pass' : 'Selected pass'}</span>
        {onBackToNext && !isNext && (
          <button type="button" className="min-h-10 px-2 text-accent" onClick={onBackToNext}>
            Back to next
          </button>
        )}
      </div>
      <div className="flex flex-wrap items-baseline gap-2">
        <h2 className="text-3xl font-black">{sat.name}</h2>
        <StatusBadge status={sat.status} />
        <DifficultyBadge sat={sat} />
      </div>

      <p className="tabular mt-2 text-2xl font-bold">
        {inProgress ? <>Up now · sets in {formatClock(pass.los - now)}</> : <>Rises {tilde}{formatCountdown(pass.aos - now)}</>}
      </p>
      <p className="tabular text-muted">
        {formatLocalDay(pass.aos)} {tilde}
        {formatLocalTime(pass.aos)}–{formatLocalTime(pass.los)} · {formatUtc(pass.aos)}
      </p>

      <div className="mt-3 grid grid-cols-2 gap-3">
        <div>
          <div className="text-sm text-muted">Highest</div>
          <div className="tabular text-3xl font-black">{Math.round(pass.maxElDeg)}°</div>
        </div>
        <div>
          <div className="text-sm text-muted">Duration</div>
          <div className="tabular text-xl font-bold">{formatDuration(durationS)}</div>
        </div>
      </div>

      <p className="mt-3 text-lg">
        {isNew ? (
          <>
            Rises in the <b>{compassWord(pass.aosAzDeg)}</b>, sets in the <b>{compassWord(pass.losAzDeg)}</b>.
          </>
        ) : (
          <span className="tabular">
            AOS {Math.round(pass.aosAzDeg)}° {compassPoint(pass.aosAzDeg)} → LOS {Math.round(pass.losAzDeg)}°{' '}
            {compassPoint(pass.losAzDeg)}
          </span>
        )}
      </p>

      {masked && (
        <p className="mt-1 font-semibold">
          Only {formatDuration(pass.visibleSecondsAboveMask)} above your horizon mask.
        </p>
      )}

      {tx && <Frequencies tx={tx} doppler={doppler} inProgress={inProgress} isNew={isNew} />}

      {!isNew && (
        <dl className="tabular mt-3 grid grid-cols-3 gap-2 text-sm">
          <div>
            <dt className="text-muted">AOS</dt>
            <dd>{formatUtc(pass.aos, true)}</dd>
          </div>
          <div>
            <dt className="text-muted">TCA</dt>
            <dd>{formatUtc(pass.tca, true)}</dd>
          </div>
          <div>
            <dt className="text-muted">LOS</dt>
            <dd>{formatUtc(pass.los, true)}</dd>
          </div>
          {doppler?.spanHz != null && (
            <div className="col-span-3">
              <dt className="inline text-muted">Downlink Doppler, AOS → LOS: </dt>
              <dd className="inline">{formatOffsetKHz(doppler.spanHz)}</dd>
            </div>
          )}
        </dl>
      )}

      {isNew && (sat.overlay.note || tx) && (
        <div className="mt-3 space-y-2 border-t border-line pt-3 text-base">
          {sat.overlay.note && <p>{sat.overlay.note}</p>}
          {tx && (
            <p className="text-muted">
              <b className="text-fg">You’ll need:</b> {gearHint(tx)}
            </p>
          )}
        </div>
      )}

      <p className={`mt-3 text-sm ${age === 'fresh' ? 'text-muted' : 'font-semibold'}`}>
        Elements {formatElementAge(pass.elementsEpoch, now)}
        {approx && ' — times are approximate'}
      </p>
      <Button
        kind="primary"
        className="mt-4 w-full text-lg"
        onClick={() => {
          // The tap is the user gesture browsers need before cues can make a sound (D14).
          createCue(station.cues).unlock();
          onStart();
        }}
      >
        {inProgress ? 'Track it now' : 'Start'}
      </Button>
      <Reminders pass={pass} sat={sat} location={location} station={station} now={now} />
      {approx && (
        <div className="mt-2">
          <Banner tone="danger">These elements are over two weeks old. The satellite may be minutes away from where this says.</Banner>
        </div>
      )}
    </article>
  );
}

function Frequencies({ tx, doppler, inProgress, isNew }: { tx: Transmitter; doppler: Doppler | null; inProgress: boolean; isNew: boolean }) {
  const t = doppler?.tuning;
  const when = inProgress ? 'now' : 'at rise';
  if (tx.kind === 'fm_repeater') {
    const down = t?.downlinkHz ?? tx.downlinkHz;
    const up = t?.uplinkHz ?? tx.uplinkHz;
    return (
      <div className="tabular mt-3 space-y-1 rounded-xl bg-bg p-3">
        {down !== null && (
          <div className="flex items-baseline justify-between gap-2">
            <span className="text-muted">↓ Listen {t?.tuneSide === 'downlink' ? when : ''}</span>
            <span className="text-2xl font-black">{formatMHz(down)}</span>
          </div>
        )}
        {up !== null && (
          <div className="flex items-baseline justify-between gap-2">
            <span className="text-muted">↑ Transmit {t?.tuneSide === 'uplink' ? when : ''}</span>
            <span className="text-2xl font-black">{formatMHz(up)}</span>
          </div>
        )}
        <div className="flex items-baseline justify-between gap-2">
          <span className="text-muted">Tone</span>
          <span className={`text-lg font-bold ${tx.ctcssHz === 'unknown' ? 'italic' : ''}`}>{formatTone(tx.ctcssHz)}</span>
        </div>
        {isNew && t?.tuneSide && (
          <p className="pt-1 text-sm text-muted">
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
    <div className="tabular mt-3 space-y-1 rounded-xl bg-bg p-3">
      <div className="text-sm text-muted">
        {tx.mode} {tx.kind === 'linear_transponder' && (tx.inverting ? '· inverting' : tx.inverting === false ? '· non-inverting' : '')}
      </div>
      {down && (
        <div className="flex items-baseline justify-between gap-2">
          <span className="text-muted">↓</span>
          <span className="text-xl font-bold">{down}</span>
        </div>
      )}
      {up && (
        <div className="flex items-baseline justify-between gap-2">
          <span className="text-muted">↑</span>
          <span className="text-xl font-bold">{up}</span>
        </div>
      )}
    </div>
  );
}

/** D17: the phone's own calendar does the reminding — one pass, or the week's good ones. */
function Reminders({ pass, sat, location, station, now }: { pass: Pass; sat: Satellite; location: Location; station: Station; now: number }) {
  const [busy, setBusy] = useState(false);
  return (
    <div className="mt-2 grid grid-cols-2 gap-2">
      <Button onClick={() => void exportPassesToCalendar([pass], sat, now, `${sat.name}-${formatLocalTime(pass.aos).replace(/\W/g, '')}`)}>
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
        {busy ? 'Working…' : `All ${sat.name} this week`}
      </Button>
    </div>
  );
}
