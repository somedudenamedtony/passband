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
import { operatingTransmitter, operatorPreferences } from '../model/operator';
import { listPassResults, resultId, savePassResult, type PassResult } from '../data/passResults';
import type { Location, Pass, QsoRecord, Recording, Satellite, Station } from '../model/types';
import { usePassRecorder } from '../record/usePassRecorder';
import { formatDistance } from '../model/units';
import { passTrackFor } from '../predict/client';
import { DisplayRig } from '../rig/rig';
import { Banner, Button, Fold, Panel, Segmented, SectionTitle } from '../ui/common';
import { OperatingHelp } from '../ui/OperatingHelp';
import { gearFor } from '../model/modes';
import { Icon } from '../ui/icons';
import { QuickLog } from '../ui/QuickLog';
import { useNow } from '../ui/clock';
import { useBack } from '../ui/back';
import { CompassStatus } from '../compass/CompassStatus';
import { useCompass } from '../compass/useCompass';
import { ARView } from './ARView';
import { LinearTuner } from './LinearTuner';
import { modeGuide } from '../model/modes';
import { adifBand } from '../model/bands';

import { Checklist } from './Checklist';
import { PointingGuide } from './PointingGuide';
import { PracticePanel, type PracticeControls } from './PracticePanel';
import { ScheduleList } from './ScheduleList';
import { SkyPlot } from './SkyPlot';
import { useWakeLock } from './useWakeLock';

/** "70 cm", for the frequency labels; empty outside the amateur bands. */
function bandName(hz: number): string {
  return adifBand(hz)?.replace(/(\d)(c?m)$/, '$1 $2') ?? '';
}

export function LiveScreen({
  pass,
  sat,
  location,
  station,
  onStation,
  onClose,
  onLog,
  onRecorded,
  onPractice,
  onReviewLog,
  onAddContacts,
  onNext,
  practice,
}: {
  pass: Pass;
  sat: Satellite;
  location: Location;
  station: Station;
  onStation: (s: Station) => void;
  onClose: () => void;
  /** Save a contact from the quick log. */
  onLog: (q: QsoRecord) => Promise<void>;
  onPractice: () => void;
  onReviewLog: () => void;
  onAddContacts: () => void;
  onNext: () => void;
  /** D13: a recording was saved. */
  onRecorded: (r: Recording) => void;
  /** D16: present only in practice. Everything else on this screen is identical. */
  practice?: PracticeControls;
}) {
  const now = useNow(250);
  useBack(onClose);
  const prefs = operatorPreferences(station);
  const isNew = prefs.tips;
  const listenOnly = station.goal === 'listen';
  const [track, setTrack] = useState<TrackPoint[] | null>(null);
  const [ackStale, setAckStale] = useState(false);
  // D19: spoken cues on for beginners, off for experienced operators; one tap either way.
  const cuesOn = prefs.cues;
  const [logAt, setLogAt] = useState<number | null>(null);
  // D10/D19: beginners get the big compass view when there is a compass; everyone can switch.
  const compass = useCompass(location, station);
  const view = prefs.view;
  const compassOk = compass.status === 'ok' && compass.reading !== null;
  const effectiveView = view !== 'sky' && compass.status === 'unsupported' ? 'sky' : view;
  const [logged, setLogged] = useState<string | null>(null);
  const tx = operatingTransmitter(sat, station);
  const [outcome, setOutcome] = useState<PassResult['outcome'] | null>(null);
  const [outcomeError, setOutcomeError] = useState(false);
  const [outcomeBusy, setOutcomeBusy] = useState(false);
  useEffect(() => {
    let cancelled = false;
    if (!practice) void listPassResults().then((rows) => { if (!cancelled) setOutcome(rows.find((r) => r.id === resultId(pass))?.outcome ?? null); }).catch(() => { if (!cancelled) setOutcomeError(true); });
    return () => { cancelled = true; };
  }, [pass, practice !== undefined]);
  async function rememberOutcome(value: PassResult['outcome']) {
    setOutcomeBusy(true);
    setOutcomeError(false);
    try { await savePassResult(pass, sat.name, value); setOutcome(value); }
    catch { setOutcomeError(true); }
    finally { setOutcomeBusy(false); }
  }
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
    () => (track ? passCues(sat.name, pass, track, listenOnly && schedule?.tuneSide === 'uplink' ? null : schedule, formatMHz, station.speakInPass) : []),
    [track, sat.name, pass, schedule, station.speakInPass, listenOnly],
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
  const pageRef = useRef<HTMLElement>(null);
  useEffect(() => { pageRef.current?.scrollTo({ top: 0 }); }, [phase]);
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
            <h1 className="setup-title">Orbit data is {formatElementAge(pass.elementsEpoch, now)}</h1>
            <p>
              Predictions for {sat.name} use orbit data more than two weeks old. The satellite may be minutes
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
  const scheduleDetails = schedule && (!listenOnly || schedule.tuneSide === 'downlink') && (
    <Fold title="Retune schedule" open={phase === 'before' || prefs.compact}>
      <ScheduleList schedule={schedule} aos={pass.aos} now={now} listenOnly={listenOnly} />
    </Fold>
  );

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
            onStation({ ...station, liveCues: !cuesOn });
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

      <main className="page" ref={pageRef}>
        <div className="page-inner stack">
          <Panel>
            <p className="phase-label">{practice ? 'Practice · ' : ''}{phase === 'before' ? 'Prepare for pass' : phase === 'during' ? 'Tracking live' : 'After the pass'}</p>
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
              {phase === 'before' && (
                <p className="lcd-note" style={{ fontSize: 15 }}>
                  Rises{' '}
                  {isNew ? `in the ${compassWord(pass.aosAzDeg)}` : `${Math.round(pass.aosAzDeg)}° ${compassPoint(pass.aosAzDeg)}`}
                </p>
              )}

              {tx && setting && phase !== 'after' && (
                <section aria-label="Frequencies">
                  <hr className="lcd-rule" />
                  <p className="lcd-label" style={{ marginBottom: 4 }}>
                    {modeGuide(tx).label} · {modeGuide(tx).what}
                  </p>
                  {setting.downlinkHz !== null && (
                    <div className="lcd-line">
                      <span className="lcd-label">↓ Listen {bandName(setting.downlinkHz)}</span>
                      <span className={`readout readout-l${flash('downlink')}`}>{formatMHz(setting.downlinkHz)}</span>
                    </div>
                  )}
                  {!listenOnly && setting.uplinkHz !== null && (
                    <div className="lcd-line">
                      <span className="lcd-label">↑ Transmit {bandName(setting.uplinkHz)}</span>
                      <span className={`readout readout-l${flash('uplink')}`}>{formatMHz(setting.uplinkHz)}</span>
                    </div>
                  )}
                  <div className="lcd-line" style={{ marginTop: 8 }}>
                    {!listenOnly && tx.kind === 'fm_repeater' && <span style={{ fontStyle: setting.ctcssHz === 'unknown' ? 'italic' : undefined }}>
                      <span className="lcd-label">Tone </span>
                      {formatTone(setting.ctcssHz)}
                    </span>}
                    {next && phase === 'during' && (!listenOnly || schedule?.tuneSide === 'downlink') && (
                      <span className="tabular">
                        <span className="lcd-label">Next {schedule?.tuneSide === 'uplink' ? '↑' : '↓'} </span>
                        {formatClock(next.t - Math.max(now, pass.aos))}
                      </span>
                    )}
                  </div>
                  {next && nextHz !== null && (!listenOnly || schedule?.tuneSide === 'downlink') && (
                    <p className="lcd-note">
                      {phase === 'before' ? `First retune: ${formatClock(next.t - pass.aos)} after rise → ` : 'Then '}{formatMHz(nextHz)}.
                      {isNew && ` Retune the ${schedule?.tuneSide === 'uplink' ? 'transmit' : 'listen'} side${listenOnly ? '' : ' only'}.`}
                    </p>
                  )}
                  {linear && (
                    <p className="lcd-note">
                      {listenOnly ? 'USB down' : `${linear.sendSideband} up, USB down`} · Doppler now {formatOffsetKHz(linear.hearHz - linear.downAtSatHz)} on the
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

          {pb && phase !== 'after' && <LinearTuner pb={pb} tuning={linear} spotHz={spotHz} onSpot={setSpotHz} isNew={isNew} listenOnly={listenOnly} />}

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
          {stale && <Banner tone="danger">Orbit data {formatElementAge(pass.elementsEpoch, now)} — positions are approximate.</Banner>}

          {practice && tx && phase !== 'after' && (
            <PracticePanel controls={practice} tx={tx} schedule={schedule} here={here} up={phase === 'during'} now={now} stepHz={station.radioStepHz} />
          )}

          {phase === 'after' && (
            <Panel label="Pass review" className="stack pass-review">
              <SectionTitle>{practice ? 'Practice complete' : 'How did the pass go?'}</SectionTitle>
              {practice ? <><p>You practised the same pointing and tuning screen used for a real pass.</p><Button onClick={onPractice}>Practise again</Button></> : <>
                <div className="key-row">
                  <Button disabled={outcomeBusy} aria-pressed={outcome === 'heard'} onClick={() => void rememberOutcome('heard')}>Heard the satellite</Button>
                  <Button disabled={outcomeBusy} aria-pressed={outcome === 'nothing'} onClick={() => void rememberOutcome('nothing')}>Heard nothing</Button>
                </div>
                {outcome === 'heard' && <p role="status">Listening result saved. Hearing and identifying a satellite is a successful pass.</p>}
                {outcome === 'nothing' && <p role="status">Listening result saved. Use “I hear nothing” below to check the setup before another pass.</p>}
                {outcomeError && <Banner tone="danger">Couldn’t save the listening result. Try again.</Banner>}
                <Button onClick={onReviewLog}>Review recordings and contacts</Button>
                {!listenOnly && tx?.uplinkHz != null && <Button onClick={onAddContacts}>Add contacts from this pass</Button>}
              </>}
              <Button kind="primary" onClick={onNext}>Find another pass</Button>
            </Panel>
          )}

          {phase === 'before' && (
            <Panel label="Pass preparation" className="stack">
              <Fold title="Preparation checklist" open={prefs.tips}>
                {tx && <p className="hint">{gearFor(tx)}</p>}
                <Checklist pass={pass} tx={tx} listenOnly={listenOnly} />
              </Fold>
              <div className="key-row">
                {!practice && tx?.kind === 'fm_repeater' && <Button onClick={onPractice}>Practice this pass</Button>}
                <Button disabled={!anyCueOutput} onClick={() => { cue.unlock(); cue.emit({ kind: 'info', speak: true, text: 'Passband cue check', t: now }); }}>Test cues</Button>
              </div>
              {prefs.tips && <p className="hint">Set the displayed frequencies on your radio. Passband guides you; radio controls stay in your hands.</p>}
            </Panel>
          )}

          {phase === 'before' && scheduleDetails}

          {phase !== 'after' && <>
          <Segmented
            label="View"
            value={effectiveView}
            onChange={(liveView) => onStation({ ...station, liveView })}
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
          </>}

          {phase === 'during' && scheduleDetails}
          {tx && <OperatingHelp tx={tx} listenOnly={listenOnly} troubleshoot={outcome === 'nothing'} />}

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
        {!listenOnly && tx?.uplinkHz != null && (
          <Button
            size="large"
            disabled={!!practice}
            onClick={() => { if (phase === 'after') onAddContacts(); else setLogAt(now); }}
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
          onSave={async (q) => {
            await onLog(q);
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
