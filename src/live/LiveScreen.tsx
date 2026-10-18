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
import type { Location, Pass, QsoRecord, Recording, Satellite, Station } from '../model/types';
import { usePassRecorder } from '../record/usePassRecorder';
import { formatDistance } from '../model/units';
import { passTrackFor } from '../predict/client';
import { DisplayRig } from '../rig/rig';
import { Banner, Button, Segmented, SectionTitle } from '../ui/common';
import {
  IonButton,
  IonButtons,
  IonContent,
  IonFooter,
  IonHeader,
  IonIcon,
  IonModal,
  IonNote,
  IonTitle,
  IonToast,
  IonToolbar,
} from '@ionic/react';
import { addOutline, micOutline, stopCircleOutline, volumeHighOutline, volumeMuteOutline } from 'ionicons/icons';
import { QuickLog } from '../ui/QuickLog';
import { useNow } from '../ui/clock';
import { CompassStatus } from '../compass/CompassStatus';
import { useCompass } from '../compass/useCompass';
import { ARView } from './ARView';
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
        <IonHeader>
          <IonToolbar>
            <IonTitle>{sat.name}</IonTitle>
          </IonToolbar>
        </IonHeader>
        <IonContent className="ion-padding">
          <h1 style={{ fontWeight: 800 }}>These elements are {formatElementAge(pass.elementsEpoch, now)}</h1>
          <p>
            Predictions for {sat.name} come from orbital elements more than two weeks old. The satellite may be minutes
            away from where this screen says, and pointing at the wrong patch of sky is the most common reason a first
            pass fails.
          </p>
          <div className="stack">
            <Button kind="primary" onClick={() => setAckStale(true)}>
              Start anyway
            </Button>
            <Button onClick={onClose}>Back</Button>
          </div>
        </IonContent>
      </LiveModal>
    );
  }

  const nextHz = next ? (schedule?.tuneSide === 'uplink' ? next.uplinkHz : next.downlinkHz) : null;

  return (
    <LiveModal onClose={onClose}>
      <IonHeader>
        <IonToolbar>
          <IonButtons slot="start">
            <IonButton
              disabled={!anyCueOutput}
              aria-pressed={cuesOn}
              aria-label={!anyCueOutput ? 'Cues are off in Settings' : cuesOn ? 'Cues on' : 'Cues off'}
              onClick={() => {
                if (!cuesOn) cue.unlock();
                setCuesOn((c) => !c);
              }}
            >
              <IonIcon slot="icon-only" icon={cuesOn && anyCueOutput ? volumeHighOutline : volumeMuteOutline} aria-hidden />
            </IonButton>
          </IonButtons>
          <IonTitle>
            {sat.name} <span className="muted tabular">▲ {Math.round(pass.maxElDeg)}°</span>
          </IonTitle>
          <IonButtons slot="end">
            <IonButton strong onClick={onClose}>
              Done
            </IonButton>
          </IonButtons>
        </IonToolbar>
      </IonHeader>

      <IonContent className="ion-padding">
        <div style={{ maxWidth: 560, margin: '0 auto' }} className="stack">
          <div className="readout readout-m ion-text-center" aria-live="off">
            {phase === 'before' && <>Rises {formatCountdown(pass.aos - now)}</>}
            {phase === 'during' && <>Sets in {formatClock(pass.los - now)}</>}
            {phase === 'after' && 'Pass over'}
          </div>

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

          <div className="sky-wrap">
            {effectiveView === 'ar' ? (
              <ARView compass={compass} sat={here} track={track ?? []} />
            ) : track ? (
              <SkyPlot
                track={track}
                now={here}
                mask={location.horizonMask}
                headingDeg={effectiveView === 'compass' && compassOk ? compass.reading!.top.azDeg : null}
              />
            ) : (
              <p className="ion-text-center muted" style={{ padding: '64px 0' }}>
                Plotting the pass…
              </p>
            )}
          </div>
          <div className="azel-row">
            {phase === 'during' && here ? (
              <>
                <div className="readout readout-xl">AZ {Math.round(here.azDeg)}</div>
                <div className="readout readout-xl">EL {Math.round(here.elDeg)}</div>
              </>
            ) : (
              <b style={{ fontSize: '1.1rem' }}>
                Rises{' '}
                {isNew ? `in the ${compassWord(pass.aosAzDeg)}` : `${Math.round(pass.aosAzDeg)}° ${compassPoint(pass.aosAzDeg)}`}
              </b>
            )}
          </div>
          {phase === 'during' && here && (
            <p className="tabular ion-text-center muted">
              {compassWord(here.azDeg)} · {formatDistance(here.rangeM, station.units)} away
              {here.rangeRateMps < 0 ? ' · approaching' : ' · receding'}
            </p>
          )}

          {tx && setting && (
            <section aria-label="Frequencies" className="freq-panel" style={{ border: '2px solid var(--ion-color-primary)' }}>
              {setting.uplinkHz !== null && (
                <div className="freq-row">
                  <span className="readout readout-m" aria-hidden>↑</span>
                  <span className="readout readout-l" style={{ flex: 1 }}>{formatMHz(setting.uplinkHz)}</span>
                  <b style={{ fontStyle: setting.ctcssHz === 'unknown' ? 'italic' : undefined }}>{formatTone(setting.ctcssHz)}</b>
                </div>
              )}
              {setting.downlinkHz !== null && (
                <div className="freq-row">
                  <span className="readout readout-m" aria-hidden>↓</span>
                  <span className="readout readout-l" style={{ flex: 1 }}>{formatMHz(setting.downlinkHz)}</span>
                  {next && phase !== 'after' && (
                    <b className="tabular">
                      next {schedule?.tuneSide === 'uplink' ? '↑' : '↓'} {formatClock(next.t - Math.max(now, pass.aos))}
                    </b>
                  )}
                </div>
              )}
              {next && phase !== 'after' && nextHz !== null && (
                <IonNote style={{ display: 'block', marginTop: 6 }}>
                  Then {formatMHz(nextHz)}.{isNew && ` Retune the ${schedule?.tuneSide === 'uplink' ? 'transmit' : 'listen'} side only.`}
                </IonNote>
              )}
              {tx.kind !== 'fm_repeater' && here && (
                <IonNote style={{ display: 'block', marginTop: 6 }}>
                  {tx.mode}. Doppler now: downlink{' '}
                  {tx.downlinkHz !== null && formatOffsetKHz((exactAt(tx, here.rangeRateMps).downlinkHz ?? 0) - tx.downlinkHz)}
                </IonNote>
              )}
            </section>
          )}

          {practice && tx && (
            <PracticePanel controls={practice} tx={tx} schedule={schedule} here={here} up={phase === 'during'} now={now} stepHz={station.radioStepHz} />
          )}

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

          {phase === 'before' && now < pass.aos - PRE_PASS && (
            <IonNote style={{ display: 'block' }}>The checklist appears five minutes before the pass.</IonNote>
          )}
        </div>
      </IonContent>

      <IonFooter>
        <IonToolbar>
          <div style={{ display: 'flex', gap: 8, padding: '0 8px' }}>
            <IonButton
              style={{ flex: 1 }}
              size="large"
              color="danger"
              fill={rec.state === 'recording' ? 'solid' : 'outline'}
              disabled={!!practice || rec.state === 'unsupported' || rec.state === 'saving'}
              onClick={rec.toggle}
              aria-label={practice ? 'Recording is off in practice' : rec.state === 'recording' ? 'Stop recording' : 'Record the pass'}
            >
              <IonIcon slot="start" icon={rec.state === 'recording' ? stopCircleOutline : micOutline} aria-hidden />
              {rec.state === 'recording' ? 'Stop' : rec.state === 'saving' ? 'Saving…' : 'Rec'}
            </IonButton>
            {tx?.uplinkHz != null && (
              <IonButton
                style={{ flex: 1 }}
                size="large"
                disabled={!!practice}
                onClick={() => setLogAt(now)}
                aria-label={practice ? 'Logging is off in practice' : 'Log a contact'}
              >
                <IonIcon slot="start" icon={addOutline} aria-hidden />
                {practice ? 'No log' : 'Log'}
              </IonButton>
            )}
          </div>
        </IonToolbar>
      </IonFooter>

      <IonToast isOpen={logged !== null} message={logged ? `Logged ${logged}` : ''} duration={2500} position="top" onDidDismiss={() => setLogged(null)} />
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

/** Full-screen, above the tabs. The phone's back button closes it (App owns the history entry). */
function LiveModal({ onClose, children }: { onClose: () => void; children: ReactNode }) {
  return (
    <IonModal isOpen onDidDismiss={onClose} aria-label="Live pass">
      {children}
    </IonModal>
  );
}
