import { useEffect, useState } from 'react';
import { downlinkHeardHz, fmTuning, type FmTuning } from '../model/doppler';
import { elementAgeLevel, formatElementAge } from '../model/elementAge';
import { formatOffsetKHz } from '../model/freq';
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
import { passOutlook } from '../model/outlook';
import { DAY } from '../model/time';
import { exportPassesToCalendar } from './calendar';
import { createCue } from '../cue/cue';
import { Banner, Button, Panel } from './common';
import { Icon } from './icons';
import { FavoriteKey } from './FavoriteKey';
import { RadioSetup } from './RadioSetup';
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

const OUTLOOK_WORD = { likely: 'Should be on.', uncertain: 'Might be on.', unlikely: 'Probably off.' } as const;

export function PassCard({
  pass,
  sat,
  location,
  station,
  now,
  isNext,
  outsideHours = false,
  onBackToNext,
  onStart,
  onInfo,
  favorite = false,
  onFavorite,
}: {
  pass: Pass;
  sat: Satellite;
  location: Location;
  station: Station;
  now: number;
  isNext: boolean;
  /** The pass starts outside the user's hours (Settings). */
  outsideHours?: boolean;
  onBackToNext?: () => void;
  onStart: () => void;
  /** Open the satellite's info sheet. */
  onInfo?: () => void;
  favorite?: boolean;
  onFavorite?: () => void;
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
  const outlook = passOutlook(pass, sat, now);

  return (
    <Panel label={`Pass of ${sat.name}`}>
      <div className="lcd">
        <div className="lcd-line lcd-label">
          <span>
            {isNext ? 'Next good pass' : 'Selected pass'}
            {outsideHours && ' · outside your hours'}
          </span>
          <span>
            <StatusBadge status={sat.status} /> <DifficultyBadge sat={sat} />
          </span>
        </div>
        <div className="lcd-line" style={{ marginTop: 6 }}>
          <h2 className="readout readout-l" style={{ fontWeight: 400 }}>
            {sat.name}
          </h2>
          <span style={{ display: 'flex', gap: 8 }}>
            {onFavorite && <FavoriteKey name={sat.name} on={favorite} onToggle={onFavorite} />}
            {onInfo && (
              <Button expand="inline" size="small" onClick={onInfo} aria-label={`About ${sat.name}`}>
                <Icon name="info" size={16} />
                Info
              </Button>
            )}
          </span>
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
            <RadioSetup
              tx={tx}
              isNew={isNew}
              tuning={
                doppler?.tuning
                  ? { ...doppler.tuning, when: inProgress ? 'now' : 'at rise' }
                  : null
              }
            />
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
        <p className={`outlook outlook-${outlook.level}`} role={outlook.level === 'unlikely' ? 'alert' : undefined}>
          <b>{OUTLOOK_WORD[outlook.level]}</b> {outlook.reason}
        </p>
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
