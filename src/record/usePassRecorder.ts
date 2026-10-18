import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { newId } from '../model/ids';
import { SECOND } from '../model/time';
import type { Pass, Recording, Satellite, Station } from '../model/types';
import { saveRecording } from '../data/recordings';
import { useClock } from '../ui/clock';
import { canRecord, PassRecorder } from './recorder';

export type RecState = 'off' | 'recording' | 'saving' | 'saved' | 'error' | 'unsupported';

/**
 * D13 on the live screen: starts at AOS when the user asked for that, stops 30 s after LOS or on
 * request, saves with the start time so playback can show UTC, and reports interruptions.
 */
export function usePassRecorder({
  pass,
  sat,
  locationId,
  transmitterId,
  station,
  now,
  disabled,
  onSaved,
}: {
  pass: Pass;
  sat: Satellite;
  locationId: string;
  transmitterId: string | null;
  station: Station;
  now: number;
  disabled: boolean;
  onSaved: (r: Recording) => void;
}) {
  const clock = useClock();
  const recorder = useMemo(() => new PassRecorder(clock), [clock]);
  const [state, setState] = useState<RecState>(() => (canRecord() ? 'off' : 'unsupported'));
  const [last, setLast] = useState<Recording | null>(null);
  const userStopped = useRef(false);

  const start = useCallback(async () => {
    if (disabled || !canRecord() || recorder.recording) return;
    try {
      await recorder.start();
      setState('recording');
    } catch {
      setState('error');
    }
  }, [disabled, recorder]);

  const stop = useCallback(async () => {
    if (!recorder.recording) return;
    setState('saving');
    const done = await recorder.stop();
    if (!done) {
      setState('error');
      return;
    }
    const r: Recording = {
      id: newId(),
      noradId: sat.noradId,
      satDisplayName: sat.name,
      locationId,
      transmitterId,
      ...done,
    };
    await saveRecording(r);
    setLast(r);
    setState('saved');
    onSaved(r);
  }, [recorder, sat, locationId, transmitterId, onSaved]);

  // Automatic start during the pass, if the user turned it on and hasn't stopped it by hand.
  const during = now >= pass.aos && now <= pass.los;
  useEffect(() => {
    if (station.recordPasses && during && state === 'off' && !userStopped.current) void start();
  }, [station.recordPasses, during, state, start]);

  // Automatic stop shortly after LOS.
  useEffect(() => {
    if (state === 'recording' && now > pass.los + 30 * SECOND) void stop();
  }, [state, now, pass.los, stop]);

  // Leaving the screen saves what was recorded. Through a ref: `stop` changes identity on parent
  // re-renders, and a cleanup tied to it would cut the recording off mid-pass.
  const stopRef = useRef(stop);
  stopRef.current = stop;
  useEffect(
    () => () => {
      void stopRef.current();
    },
    [],
  );

  const toggle = useCallback(() => {
    if (recorder.recording) {
      userStopped.current = true;
      void stop();
    } else {
      void start();
    }
  }, [recorder, start, stop]);

  return { state, toggle, last, interrupted: recorder.wasInterrupted || (last?.interrupted ?? false) };
}
