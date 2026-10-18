// §5.2: the screen that matters most. It reads time only from the injected Clock (D16), so practice
// mode can run it unchanged on a simulated one.

import { useEffect, useMemo, useRef, useState, useSyncExternalStore, type ReactNode } from 'react';
import { createCue, cueSupport } from '../cue/cue';
import { dueCues, passCues } from '../model/cues';
import { elementAgeLevel, formatElementAge } from '../model/elementAge';
import { formatMHz, formatOffsetKHz, formatTone } from '../model/freq';
import { compassPoint, compassWord, formatClock, formatCountdown } from '../model/format';
import { exactAt, retuneSchedule, stepAt } from '../model/schedule';
import { MINUTE } from '../model/time';
import { sampleAt, type TrackPoint } from '../model/track';
import { primaryTransmitter } from '../model/transmitters';
import type { Location, Pass, Satellite, Station } from '../model/types';
import { formatDistance } from '../model/units';
import { passTrackFor } from '../predict/client';
import { DisplayRig } from '../rig/rig';
import { Banner, Button } from '../ui/common';
import { useNow } from '../ui/clock';
import { Checklist } from './Checklist';
import { PracticePanel, type PracticeControls } from './PracticePanel';
import { ScheduleList } from './ScheduleList';
import { SkyPlot } from './SkyPlot';
import { useWakeLock } from './useWakeLock';

const PRE_PASS = 5 * MINUTE;

export function LiveScreen({
  pass,
  sat,
  location,
  station,
  onClose,
  practice,
}: {
  pass: Pass;
  sat: Satellite;
  location: Location;
  station: Station;
  onClose: () => void;
  /** D16: present only in practice. Everything else on this screen is identical. */
  practice?: PracticeControls;
}) {
  const now = useNow(250);
  const isNew = station.experience === 'new';
  const [track, setTrack] = useState<TrackPoint[] | null>(null);
  const [ackStale, setAckStale] = useState(false);
  // D19: spoken cues on for beginners, off for experienced operators; one tap either way.
  const [cuesOn, setCuesOn] = useState(isNew);
  const tx = primaryTransmitter(sat);

  useEffect(() => {
    let cancelled = false;
    void passTrackFor(sat, location, pass).then((t) => {
      if (!cancelled) setTrack(t);
    });
    return () => {
      cancelled = true;
    };
  }, [sat, location, pass]);

  const schedule = useMemo(
    () => (track && tx?.kind === 'fm_repeater' ? retuneSchedule(track, tx, station.radioStepHz) : null),
    [track, tx, station.radioStepHz],
  );
  const cueEvents = useMemo(
    () => (track ? passCues(sat.name, pass, track, schedule, formatMHz) : []),
    [track, sat.name, pass, schedule],
  );

  // D14: fire cues as the clock crosses them.
  const cue = useMemo(() => createCue(station.cues), [station.cues]);
  const lastTick = useRef(now);
  useEffect(() => {
    const prev = lastTick.current;
    lastTick.current = now;
    if (!cuesOn) return;
    for (const e of dueCues(cueEvents, prev, now)) cue.emit(e);
  }, [now, cuesOn, cueEvents, cue]);
  useEffect(() => () => cue.stop(), [cue]);

  // D15: wake lock from AOS − 2 min to LOS + 1 min.
  const wakeActive = now >= pass.aos - 2 * MINUTE && now <= pass.los + MINUTE;
  const wake = useWakeLock(wakeActive);

  // D18: frequencies go through the rig; v1's rig is this screen.
  const rig = useMemo(() => new DisplayRig(), []);
  const { current, next } = schedule ? stepAt(schedule, now) : { current: null, next: null };
  useEffect(() => {
    if (!tx) return;
    rig.set({
      uplinkHz: current?.uplinkHz ?? tx.uplinkHz,
      downlinkHz: current?.downlinkHz ?? tx.downlinkHz,
      ctcssHz: tx.ctcssHz,
    });
  }, [rig, tx, current]);
  const setting = useSyncExternalStore(rig.subscribe, () => rig.get());

  const stale = elementAgeLevel(pass.elementsEpoch, now) === 'stale';
  const phase = now < pass.aos ? 'before' : now <= pass.los ? 'during' : 'after';
  const here = track ? sampleAt(track, now) : null;
  const support = cueSupport();
  const anyCueOutput =
    (station.cues.speech && support.speech) || (station.cues.tones && support.tones) || (station.cues.vibration && support.vibration);

  if (stale && !ackStale) {
    return (
      <Overlay>
        <div className="space-y-4 py-6">
          <h1 className="text-2xl font-bold">These elements are {formatElementAge(pass.elementsEpoch, now)}</h1>
          <p>
            Predictions for {sat.name} come from orbital elements more than two weeks old. The satellite may be minutes
            away from where this screen says, and pointing at the wrong patch of sky is the most common reason a first
            pass fails.
          </p>
          <div className="flex flex-col gap-2">
            <Button kind="primary" onClick={() => setAckStale(true)}>
              Start anyway
            </Button>
            <Button onClick={onClose}>Back</Button>
          </div>
        </div>
      </Overlay>
    );
  }

  return (
    <Overlay>
      <header className="flex items-center gap-3 py-2">
        <h1 className="text-3xl font-black">{sat.name}</h1>
        <span className="tabular text-lg font-bold">▲ {Math.round(pass.maxElDeg)}°</span>
        <span className="tabular ml-auto text-lg font-bold" aria-live="off">
          {phase === 'before' && <>rises {formatCountdown(pass.aos - now)}</>}
          {phase === 'during' && <>⏱ {formatClock(pass.los - now)}</>}
          {phase === 'after' && 'Pass over'}
        </span>
      </header>

      {(wake === 'failed' || wake === 'unsupported') && (
        <Banner tone="warn">Keep the screen on — your phone may lock.</Banner>
      )}
      {stale && <Banner tone="danger">Elements {formatElementAge(pass.elementsEpoch, now)} — positions are approximate.</Banner>}

      <div className="relative">
        {track ? <SkyPlot track={track} now={here} mask={location.horizonMask} /> : <p className="py-16 text-center text-muted">Plotting the pass…</p>}
        <div className="tabular absolute right-0 bottom-0 text-right">
          {phase === 'during' && here ? (
            <>
              <div className="text-3xl font-black">AZ {Math.round(here.azDeg)}</div>
              <div className="text-3xl font-black">EL {Math.round(here.elDeg)}</div>
            </>
          ) : (
            <div className="text-lg font-bold">
              Rises {isNew ? `in the ${compassWord(pass.aosAzDeg)}` : `${Math.round(pass.aosAzDeg)}° ${compassPoint(pass.aosAzDeg)}`}
            </div>
          )}
        </div>
      </div>
      {phase === 'during' && here && (
        <p className="tabular text-center text-muted">
          {compassWord(here.azDeg)} · {formatDistance(here.rangeM, station.units)} away
          {here.rangeRateMps < 0 ? ' · approaching' : ' · receding'}
        </p>
      )}

      {tx && setting && (
        <section aria-label="Frequencies" className="tabular my-3 space-y-1 rounded-2xl border-2 border-accent bg-surface p-3">
          {setting.uplinkHz !== null && (
            <div className="flex items-baseline gap-3">
              <span className="w-6 text-2xl">↑</span>
              <span className="text-3xl font-black">{formatMHz(setting.uplinkHz)}</span>
              <span className={`ml-auto text-lg font-bold ${setting.ctcssHz === 'unknown' ? 'italic' : ''}`}>
                {formatTone(setting.ctcssHz)}
              </span>
            </div>
          )}
          {setting.downlinkHz !== null && (
            <div className="flex items-baseline gap-3">
              <span className="w-6 text-2xl">↓</span>
              <span className="text-3xl font-black">{formatMHz(setting.downlinkHz)}</span>
              {next && phase !== 'after' && (
                <span className="ml-auto text-lg font-bold">
                  next {schedule?.tuneSide === 'uplink' ? '↑' : '↓'}{' '}
                  {formatClock(next.t - Math.max(now, pass.aos))}
                </span>
              )}
            </div>
          )}
          {next && phase !== 'after' && (
            <p className="text-sm text-muted">
              Then {formatMHz((schedule?.tuneSide === 'uplink' ? next.uplinkHz : next.downlinkHz) ?? 0)}.
              {isNew && ` Retune the ${schedule?.tuneSide === 'uplink' ? 'transmit' : 'listen'} side only.`}
            </p>
          )}
          {tx.kind !== 'fm_repeater' && here && (
            <p className="text-sm text-muted">
              {tx.mode}. Doppler now: downlink{' '}
              {tx.downlinkHz !== null && formatOffsetKHz((exactAt(tx, here.rangeRateMps).downlinkHz ?? 0) - tx.downlinkHz)}
            </p>
          )}
        </section>
      )}

      {practice && tx && (
        <PracticePanel
          controls={practice}
          tx={tx}
          schedule={schedule}
          here={here}
          up={phase === 'during'}
          now={now}
          stepHz={station.radioStepHz}
        />
      )}

      {phase === 'before' && now >= pass.aos - PRE_PASS && (
        <section className="my-4">
          <h2 className="mb-2 text-lg font-bold">Before it rises</h2>
          <Checklist pass={pass} tx={tx} />
        </section>
      )}

      {schedule && (phase === 'before' || !isNew) && (
        <section className="my-4">
          <h2 className="mb-2 text-lg font-bold">Retune schedule</h2>
          <ScheduleList schedule={schedule} aos={pass.aos} now={now} />
        </section>
      )}

      {phase === 'before' && now < pass.aos - PRE_PASS && (
        <p className="my-3 text-sm text-muted">The checklist appears five minutes before the pass.</p>
      )}

      <div className="sticky bottom-0 mt-auto flex gap-3 bg-bg py-3">
        <Button
          kind={cuesOn ? 'primary' : 'secondary'}
          className="flex-1"
          disabled={!anyCueOutput}
          onClick={() => {
            if (!cuesOn) cue.unlock();
            setCuesOn((c) => !c);
          }}
        >
          {!anyCueOutput ? 'Cues off in Settings' : cuesOn ? '🔊 Cues on' : '🔇 Cues off'}
        </Button>
        <Button className="flex-1" onClick={onClose}>
          Done
        </Button>
      </div>
    </Overlay>
  );
}

function Overlay({ children }: { children: ReactNode }) {
  // The page underneath must not scroll while the live screen is up.
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);
  return (
    <div className="fixed inset-0 z-30 overflow-y-auto bg-bg">
      <div className="mx-auto flex min-h-dvh max-w-lg flex-col px-4">{children}</div>
    </div>
  );
}
