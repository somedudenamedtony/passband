// §5.2: the screen that matters most. It reads time only from the injected Clock (D16), so practice
// mode can run it unchanged on a simulated one.

import { useEffect, useMemo, useRef, useState, useSyncExternalStore, type ReactNode } from 'react';
import { createCue, cueSupport } from '../cue/cue';
import { dueCues, passCues } from '../model/cues';
import { elementAgeLevel, formatElementAge } from '../model/elementAge';
import { formatMHz, formatOffsetKHz, formatTone } from '../model/freq';
import { compassPoint, compassWord, formatClock, formatCountdown } from '../model/format';
import { retuneSchedule, stepAt } from '../model/schedule';
import { linearTuning, passband, passbandCentre } from '../model/linear';
import { MINUTE } from '../model/time';
import { sampleAt, type TrackPoint } from '../model/track';
import { primaryTransmitter } from '../model/transmitters';
import type { Location, Pass, QsoRecord, Recording, Satellite, Station } from '../model/types';
import { usePassRecorder } from '../record/usePassRecorder';
import { formatDistance } from '../model/units';
import { passTrackFor } from '../predict/client';
import { DisplayRig } from '../rig/rig';
import { Banner, Button, Panel, Segmented, SectionTitle } from '../ui/common';
import { Icon } from '../ui/icons';
import { QuickLog } from '../ui/QuickLog';
import { useNow } from '../ui/clock';
import { useBack } from '../ui/back';
import { CompassStatus } from '../compass/CompassStatus';
import { useCompass } from '../compass/useCompass';
import { ARView } from './ARView';
import { LinearTuner } from './LinearTuner';
import { Checklist } from './Checklist';
import { PointingGuide } from './PointingGuide';
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
  onLog,
  onRecorded,
  practice,
}: {
  pass: Pass;
  sat: Satellite;
  location: Location;
  station: Station;
  onClose: () => void;
  /** Save a contact from the quick log. */
  onLog: (q: QsoRecord) => void;
  /** D13: a recording was saved. */
  onRecorded: (r: Recording) => void;
  /** D16: present only in practice. Everything else on this screen is identical. */
  practice?: PracticeControls;
}) {
  const now = useNow(250);
  useBack(onClose);
  const isNew = station.experience === 'new';
  const [track, setTrack] = useState<TrackPoint[] | null>(null);
  const [ackStale, setAckStale] = useState(false);
  // D19: spoken cues on for beginners, off for experienced operators; one tap either way.
  const [cuesOn, setCuesOn] = useState(isNew);
  const [logAt, setLogAt] = useState<number | null>(null);
  // D10/D19: beginners get the big compass view when there is a compass; everyone can switch.
  const compass = useCompass(location, station);
  const [view, setView] = useState<'sky' | 'compass' | 'ar'>(isNew ? 'compass' : 'sky');
  const compassOk = compass.status === 'ok' && compass.reading !== null;
  const effectiveView = view !== 'sky' && compass.status === 'unsupported' ? 'sky' : view;
  const [logged, setLogged] = useState<string | null>(null);
  const tx = primaryTransmitter(sat);
  const pb = useMemo(() => (tx ? passband(tx) : null), [tx]);
  // §8.1: the spot in a linear passband, at the satellite. Starts mid-passband.
  const [spotHz, setSpotHz] = useState(() => (pb ? passbandCentre(pb) : 0));

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
    () => (track ? passCues(sat.name, pass, track, schedule, formatMHz, station.speakInPass) : []),
    [track, sat.name, pass, schedule, station.speakInPass],
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
  // Range rate now; sampleAt holds the first point before AOS and the last after LOS.
  const sample = track ? sampleAt(track, now) : null;
  const linear = pb && sample ? linearTuning(pb, spotHz, sample.rangeRateMps) : null;
  const linearSend = linear?.sendHz ?? null;
  const linearHear = linear?.hearHz ?? null;
  useEffect(() => {
    if (!tx) return;
    // A linear transponder's nominal values are its passband edges, not something to set: show
    // nothing until the track is in and the tuning can be worked out.
    rig.set({
      uplinkHz: pb ? linearSend : (current?.uplinkHz ?? tx.uplinkHz),
      downlinkHz: pb ? linearHear : (current?.downlinkHz ?? tx.downlinkHz),
      ctcssHz: tx.ctcssHz,
    });
  }, [rig, tx, pb, current, linearSend, linearHear]);
  const setting = useSyncExternalStore(rig.subscribe, () => rig.get());

  const rec = usePassRecorder({
    pass,
    sat,
    locationId: location.id,
    transmitterId: tx?.id ?? null,
    station,
    now,
    disabled: !!practice,
    onSaved: onRecorded,
  });

  const stale = elementAgeLevel(pass.elementsEpoch, now) === 'stale';
  const phase = now < pass.aos ? 'before' : now <= pass.los ? 'during' : 'after';
  const here = track ? sampleAt(track, now) : null;
  const support = cueSupport();
  const anyCueOutput =
    (station.cues.speech && support.speech) || (station.cues.tones && support.tones) || (station.cues.vibration && support.vibration);

  if (stale && !ackStale) {
    return (
      <LiveModal onClose={onClose}>
        <header className="topbar">
          <span className="wordmark">{sat.name}</span>
          <span className="topbar-rule" aria-hidden />
        </header>
        <main className="page">
          <div className="page-inner stack">
            <h1 className="setup-title">These elements are {formatElementAge(pass.elementsEpoch, now)}</h1>
            <p>
              Predictions for {sat.name} come from orbital elements more than two weeks old. The satellite may be minutes
              away from where this screen says, and pointing at the wrong patch of sky is the most common reason a first
              pass fails.
            </p>
            <Button kind="primary" onClick={() => setAckStale(true)}>
              Start anyway
            </Button>
            <Button onClick={onClose}>Back</Button>
          </div>
        </main>
      </LiveModal>
    );
  }

  // A retune just happened: light up the side that changed, since the cue may only have beeped.
  const justRetuned = current !== null && current.t > pass.aos && now - current.t < 4000;
  const flash = (side: 'uplink' | 'downlink') => (justRetuned && schedule?.tuneSide === side ? ' readout-flash' : '');
  const nextHz = next ? (schedule?.tuneSide === 'uplink' ? next.uplinkHz : next.downlinkHz) : null;

  const bars = here && phase === 'during' ? Math.max(0, Math.round(here.elDeg / 9)) : 0;

  return (
    <LiveModal onClose={onClose}>
      <header className="topbar">
        <Button
          expand="inline"
          className="key-icon"
          disabled={!anyCueOutput}
          aria-pressed={cuesOn && anyCueOutput}
          aria-label={!anyCueOutput ? 'Cues are off in Settings' : cuesOn ? 'Cues on' : 'Cues off'}
          onClick={() => {
            if (!cuesOn) cue.unlock();
            setCuesOn((c) => !c);
          }}
        >
          <Icon name={cuesOn && anyCueOutput ? 'volumeOn' : 'volumeOff'} />
        </Button>
        <span className="wordmark" style={{ letterSpacing: '0.12em' }}>
          {sat.name} <span className="muted mono">▲{Math.round(pass.maxElDeg)}°</span>
        </span>
        <span className="topbar-rule" aria-hidden />
        <Button expand="inline" kind="primary" size="small" onClick={onClose}>
          Done
        </Button>
      </header>

      <main className="page">
        <div className="page-inner stack">
          <Panel>
            <div className="lcd">
              <div className="lcd-line">
                <span className="lcd-label">{phase === 'before' ? 'AOS' : phase === 'during' ? 'LOS' : ''}</span>
                <span className="readout readout-m" aria-live="off">
                  {phase === 'before' && <>Rises {formatCountdown(pass.aos - now)}</>}
                  {phase === 'during' && <>Sets in {formatClock(pass.los - now)}</>}
                  {phase === 'after' && 'Pass over'}
                </span>
              </div>

              {phase === 'during' && here && (
                <>
                  <div className="azel-row" style={{ marginTop: 10 }}>
                    <div className="readout readout-xl">AZ {Math.round(here.azDeg)}</div>
                    <div className="readout readout-xl">EL {Math.round(here.elDeg)}</div>
                  </div>
                  <div className="bargraph" aria-hidden>
                    {Array.from({ length: 10 }, (_, i) => (
                      <span key={i} className={i < bars ? 'on' : undefined} />
                    ))}
                  </div>
                  <p className="lcd-note">
                    {compassWord(here.azDeg)} · {formatDistance(here.rangeM, station.units)} away
                    {here.rangeRateMps < 0 ? ' · approaching' : ' · receding'}
                  </p>
                </>
              )}
              {phase !== 'during' && (
                <p className="lcd-note" style={{ fontSize: 15 }}>
                  Rises{' '}
                  {isNew ? `in the ${compassWord(pass.aosAzDeg)}` : `${Math.round(pass.aosAzDeg)}° ${compassPoint(pass.aosAzDeg)}`}
                </p>
              )}

              {tx && setting && (
                <section aria-label="Frequencies">
                  <hr className="lcd-rule" />
                  {setting.downlinkHz !== null && (
                    <div className="lcd-line">
                      <span className="lcd-label">RX ▼</span>
                      <span className={`readout readout-l${flash('downlink')}`}>{formatMHz(setting.downlinkHz)}</span>
                    </div>
                  )}
                  {setting.uplinkHz !== null && (
                    <div className="lcd-line">
                      <span className="lcd-label">TX ▲</span>
                      <span className={`readout readout-l${flash('uplink')}`}>{formatMHz(setting.uplinkHz)}</span>
                    </div>
                  )}
                  <div className="lcd-line" style={{ marginTop: 8 }}>
                    <span style={{ fontStyle: setting.ctcssHz === 'unknown' ? 'italic' : undefined }}>
                      <span className="lcd-label">Tone </span>
                      {formatTone(setting.ctcssHz)}
                    </span>
                    {next && phase !== 'after' && (
                      <span className="tabular">
                        <span className="lcd-label">Next {schedule?.tuneSide === 'uplink' ? '▲' : '▼'} </span>
                        {formatClock(next.t - Math.max(now, pass.aos))}
                      </span>
                    )}
                  </div>
                  {next && phase !== 'after' && nextHz !== null && (
                    <p className="lcd-note">
                      Then {formatMHz(nextHz)}.{isNew && ` Retune the ${schedule?.tuneSide === 'uplink' ? 'transmit' : 'listen'} side only.`}
                    </p>
                  )}
                  {linear && (
                    <p className="lcd-note">
                      {linear.sendSideband} up, USB down · Doppler now {formatOffsetKHz(linear.hearHz - linear.downAtSatHz)} on the
                      downlink
                    </p>
                  )}
                  {tx.kind === 'linear_transponder' && !pb && (
                    <p className="lcd-note">Passband edges or inversion Unknown for this transponder, so no tuning help.</p>
                  )}
                </section>
              )}
            </div>
          </Panel>

          {pb && <LinearTuner pb={pb} tuning={linear} spotHz={spotHz} onSpot={setSpotHz} isNew={isNew} />}

          {rec.state === 'recording' && (
            <p role="status" className="recording-dot">
              ● Recording{rec.interrupted && ' — it was interrupted, keep the screen on'}
            </p>
          )}
          {rec.state === 'saved' && rec.last && (
            <Banner tone={rec.last.interrupted ? 'warn' : 'info'}>
              {rec.last.interrupted
                ? `Recording was interrupted (the screen locked or the app went to the background). Kept ${formatClock(rec.last.durationMs)}.`
                : `Recording saved: ${formatClock(rec.last.durationMs)}. Play it back from the Log.`}
            </Banner>
          )}
          {rec.state === 'error' && <Banner tone="warn">Couldn’t record — microphone access may have been refused.</Banner>}
          {(wake === 'failed' || wake === 'unsupported') && <Banner tone="warn">Keep the screen on — your phone may lock.</Banner>}
          {stale && <Banner tone="danger">Elements {formatElementAge(pass.elementsEpoch, now)} — positions are approximate.</Banner>}

          {practice && tx && (
            <PracticePanel controls={practice} tx={tx} schedule={schedule} here={here} up={phase === 'during'} now={now} stepHz={station.radioStepHz} />
          )}

          <Segmented
            label="View"
            value={effectiveView}
            onChange={setView}
            options={[
              { value: 'sky', label: 'Sky' },
              { value: 'compass', label: 'Compass' },
              { value: 'ar', label: 'AR' },
            ]}
          />
          {view !== 'sky' && <CompassStatus compass={compass} station={station} now={now} />}
          {effectiveView === 'compass' && compassOk && here && <PointingGuide target={here} device={compass.reading!.top} />}

          <Panel>
            {effectiveView === 'ar' ? (
              <ARView compass={compass} sat={here} track={track ?? []} />
            ) : (
              <div className="lcd sky-wrap">
                {track ? (
                  <SkyPlot
                    track={track}
                    now={here}
                    mask={location.horizonMask}
                    headingDeg={effectiveView === 'compass' && compassOk ? compass.reading!.top.azDeg : null}
                  />
                ) : (
                  <p className="center muted" style={{ padding: '64px 0' }}>
                    Plotting the pass…
                  </p>
                )}
              </div>
            )}
          </Panel>

          {phase === 'before' && now >= pass.aos - PRE_PASS && (
            <section>
              <SectionTitle>Before it rises</SectionTitle>
              <Checklist pass={pass} tx={tx} />
            </section>
          )}

          {schedule && (phase === 'before' || !isNew) && (
            <section>
              <SectionTitle>Retune schedule</SectionTitle>
              <ScheduleList schedule={schedule} aos={pass.aos} now={now} />
            </section>
          )}

          {phase === 'before' && now < pass.aos - PRE_PASS && <p className="hint">The checklist appears five minutes before the pass.</p>}
        </div>
      </main>

      <footer className="live-foot">
        <Button
          kind="danger"
          size="large"
          aria-pressed={rec.state === 'recording'}
          disabled={!!practice || rec.state === 'unsupported' || rec.state === 'saving'}
          onClick={rec.toggle}
          aria-label={practice ? 'Recording is off in practice' : rec.state === 'recording' ? 'Stop recording' : 'Record the pass'}
        >
          <Icon name={rec.state === 'recording' ? 'stop' : 'mic'} />
          {rec.state === 'recording' ? 'Stop' : rec.state === 'saving' ? 'Saving…' : 'Rec'}
        </Button>
        {tx?.uplinkHz != null && (
          <Button
            size="large"
            disabled={!!practice}
            onClick={() => setLogAt(now)}
            aria-label={practice ? 'Logging is off in practice' : 'Log a contact'}
          >
            <Icon name="add" />
            {practice ? 'No log' : 'Log'}
          </Button>
        )}
      </footer>

      {logged !== null && <Toast text={`Logged ${logged}`} onDone={() => setLogged(null)} />}
      {logAt !== null && tx && (
        <QuickLog
          sat={sat}
          tx={tx}
          setting={setting}
          location={location}
          station={station}
          timeOn={logAt}
          onClose={() => setLogAt(null)}
          onSave={(q) => {
            onLog(q);
            setLogAt(null);
            setLogged(q.call);
          }}
        />
      )}
    </LiveModal>
  );
}

/** A short confirmation at the top of the screen. */
function Toast({ text, onDone }: { text: string; onDone: () => void }) {
  // Keyed on the text, not onDone: the screen re-renders several times a second.
  const done = useRef(onDone);
  done.current = onDone;
  useEffect(() => {
    const id = setTimeout(() => done.current(), 2500);
    return () => clearTimeout(id);
  }, [text]);
  return (
    <div role="status" className="toast">
      {text}
    </div>
  );
}

/** Full-screen, above the tabs. The phone's back button closes it (App owns the history entry). */
function LiveModal({ children }: { onClose: () => void; children: ReactNode }) {
  return (
    <div role="dialog" aria-modal="true" aria-label="Live pass" className="live">
      {children}
    </div>
  );
}
