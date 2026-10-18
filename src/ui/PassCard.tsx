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
import { IonButton, IonCard, IonCardContent, IonCardHeader, IonCardSubtitle, IonCardTitle, IonIcon, IonNote } from '@ionic/react';
import { calendarOutline, playOutline } from 'ionicons/icons';
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
    <IonCard style={{ margin: 0 }} aria-label={`Pass of ${sat.name}`}>
      <IonCardHeader>
        <IonCardSubtitle>
          {isNext ? 'Next good pass' : 'Selected pass'}
          {onBackToNext && !isNext && (
            <IonButton fill="clear" size="small" onClick={onBackToNext} style={{ float: 'right', margin: '-6px -8px 0 0' }}>
              Back to next
            </IonButton>
          )}
        </IonCardSubtitle>
        <IonCardTitle style={{ fontSize: '2rem', fontWeight: 800 }}>
          {sat.name} <StatusBadge status={sat.status} /> <DifficultyBadge sat={sat} />
        </IonCardTitle>
      </IonCardHeader>
      <IonCardContent>
        <div className="readout readout-m" style={{ color: 'var(--fg)' }}>
          {inProgress ? <>Up now · sets in {formatClock(pass.los - now)}</> : <>Rises {tilde}{formatCountdown(pass.aos - now)}</>}
        </div>
        <p className="tabular">
          {formatLocalDay(pass.aos)} {tilde}
          {formatLocalTime(pass.aos)}–{formatLocalTime(pass.los)} · {formatUtc(pass.aos)}
        </p>

        <div className="stat-row" style={{ marginTop: 12 }}>
          <div>
            <IonNote>Highest</IonNote>
            <div className="readout readout-l" style={{ color: 'var(--fg)' }}>
              {Math.round(pass.maxElDeg)}°
            </div>
          </div>
          <div>
            <IonNote>Duration</IonNote>
            <div className="readout readout-m" style={{ color: 'var(--fg)' }}>
              {formatDuration(durationS)}
            </div>
          </div>
        </div>

        <p style={{ fontSize: '1.05rem', marginTop: 12, color: 'var(--fg)' }}>
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
          <p style={{ fontWeight: 600 }}>Only {formatDuration(pass.visibleSecondsAboveMask)} above your horizon mask.</p>
        )}

        {tx && <Frequencies tx={tx} doppler={doppler} inProgress={inProgress} isNew={isNew} />}

        {!isNew && (
          <div className="tabular" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginTop: 12 }}>
            <div>
              <IonNote>AOS</IonNote>
              <div>{formatUtc(pass.aos, true)}</div>
            </div>
            <div>
              <IonNote>TCA</IonNote>
              <div>{formatUtc(pass.tca, true)}</div>
            </div>
            <div>
              <IonNote>LOS</IonNote>
              <div>{formatUtc(pass.los, true)}</div>
            </div>
            {doppler?.spanHz != null && (
              <div style={{ gridColumn: 'span 3' }}>
                <IonNote>Downlink Doppler, AOS → LOS: </IonNote>
                {formatOffsetKHz(doppler.spanHz)}
              </div>
            )}
          </div>
        )}

        {isNew && (sat.overlay.note || tx) && (
          <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--border)' }}>
            {sat.overlay.note && <p style={{ color: 'var(--fg)' }}>{sat.overlay.note}</p>}
            {tx && (
              <p style={{ marginTop: 8 }}>
                <b style={{ color: 'var(--fg)' }}>You’ll need:</b> {gearHint(tx)}
              </p>
            )}
          </div>
        )}

        <p style={{ marginTop: 12, fontWeight: age === 'fresh' ? 400 : 600 }}>
          Elements {formatElementAge(pass.elementsEpoch, now)}
          {approx && ' — times are approximate'}
        </p>
        <Button
          kind="primary"
          size="large"
          className="ion-margin-top"
          onClick={() => {
            // The tap is the user gesture browsers need before cues can make a sound (D14).
            createCue(station.cues).unlock();
            onStart();
          }}
        >
          <IonIcon slot="start" icon={playOutline} aria-hidden />
          {inProgress ? 'Track it now' : 'Start'}
        </Button>
        <Reminders pass={pass} sat={sat} location={location} station={station} now={now} />
        {approx && (
          <Banner tone="danger">These elements are over two weeks old. The satellite may be minutes away from where this says.</Banner>
        )}
      </IonCardContent>
    </IonCard>
  );
}

function Frequencies({ tx, doppler, inProgress, isNew }: { tx: Transmitter; doppler: Doppler | null; inProgress: boolean; isNew: boolean }) {
  const t = doppler?.tuning;
  const when = inProgress ? 'now' : 'at rise';
  if (tx.kind === 'fm_repeater') {
    const down = t?.downlinkHz ?? tx.downlinkHz;
    const up = t?.uplinkHz ?? tx.uplinkHz;
    return (
      <div className="freq-panel" style={{ marginTop: 12 }}>
        {down !== null && (
          <div className="freq-row">
            <span className="freq-label">↓ Listen {t?.tuneSide === 'downlink' ? when : ''}</span>
            <span className="readout readout-m" style={{ color: 'var(--fg)' }}>{formatMHz(down)}</span>
          </div>
        )}
        {up !== null && (
          <div className="freq-row">
            <span className="freq-label">↑ Transmit {t?.tuneSide === 'uplink' ? when : ''}</span>
            <span className="readout readout-m" style={{ color: 'var(--fg)' }}>{formatMHz(up)}</span>
          </div>
        )}
        <div className="freq-row">
          <span className="freq-label">Tone</span>
          <b style={{ color: 'var(--fg)', fontStyle: tx.ctcssHz === 'unknown' ? 'italic' : undefined }}>
            {formatTone(tx.ctcssHz)}
          </b>
        </div>
        {isNew && t?.tuneSide && (
          <p style={{ marginTop: 6, fontSize: '0.85rem' }}>
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
    <div className="freq-panel" style={{ marginTop: 12 }}>
      <IonNote>
        {tx.mode} {tx.kind === 'linear_transponder' && (tx.inverting ? '· inverting' : tx.inverting === false ? '· non-inverting' : '')}
      </IonNote>
      {down && (
        <div className="freq-row">
          <span className="freq-label">↓</span>
          <b className="readout" style={{ fontSize: '1.2rem', color: 'var(--fg)' }}>{down}</b>
        </div>
      )}
      {up && (
        <div className="freq-row">
          <span className="freq-label">↑</span>
          <b className="readout" style={{ fontSize: '1.2rem', color: 'var(--fg)' }}>{up}</b>
        </div>
      )}
    </div>
  );
}

/** D17: the phone's own calendar does the reminding — one pass, or the week's good ones. */
function Reminders({ pass, sat, location, station, now }: { pass: Pass; sat: Satellite; location: Location; station: Station; now: number }) {
  const [busy, setBusy] = useState(false);
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
      <Button onClick={() => void exportPassesToCalendar([pass], sat, now, `${sat.name}-${formatLocalTime(pass.aos).replace(/\W/g, '')}`)}>
        <IonIcon slot="start" icon={calendarOutline} aria-hidden />
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
