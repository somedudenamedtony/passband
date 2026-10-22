// SPEC-v2 §6.3: the live view at /pass/:id/live. The v1 live screen is the strongest part of the
// app and is hosted here as it is: contacts and recordings logged from it carry the pass id (D23),
// practice runs it on a simulated clock (D16), and its review hands back to the pass page.

import { useEffect, useState, type ReactNode } from 'react';
import { SimulatedClock, systemClock } from '../clock';
import { saveRecording } from '../data/recordings';
import { LiveScreen } from '../live/LiveScreen';
import { parsePassId, type PassId } from '../model/passId';
import type { PracticeRate } from '../model/practice';
import { fromV1Station, toV1Station } from '../model/stationV2';
import { SECOND } from '../model/time';
import { goUp, navigate } from '../router';
import { usePass } from '../store/passes';
import { store, useActiveLocation, useAppState } from '../store/store';
import { ClockContext } from '../ui/clock';
import { Gone } from './PassPage';

interface Practice {
  clock: SimulatedClock;
  rate: PracticeRate;
  run: number;
}

export function LivePage({ id, startPractice = false }: { id: PassId; startPractice?: boolean }) {
  const { noradId, aosMinuteMs } = parsePassId(id)!;
  const sat = useAppState((s) => s.catalog?.catalog.satellites.find((x) => x.noradId === noradId) ?? null);
  const station = useAppState((s) => s.station);
  const location = useActiveLocation();
  const { pass } = usePass(sat, location, id, aosMinuteMs);
  const [practice, setPractice] = useState<Practice | null>(null);
  // Opened as practice: start a minute before AOS, as the v1 practice did, once the pass is known.
  const [wantPractice, setWantPractice] = useState(startPractice);
  useEffect(() => {
    if (!wantPractice || !pass) return;
    setWantPractice(false);
    setPractice({ clock: new SimulatedClock(pass.aos - 60 * SECOND, 1), rate: 1, run: 1 });
  }, [wantPractice, pass]);

  const plain = (body: ReactNode) => (
    <div className="shell">
      <main className="page">
        <div className="page-inner">{body}</div>
      </main>
    </div>
  );
  if (!location) return plain(<Gone title="No location yet" text="Set where you are on Now, and this pass will be worked out for it." />);
  if (!sat || !station) return plain(<Gone title="Unknown satellite" text={`NORAD ${noradId} isn’t in the satellite data on this device.`} />);
  if (pass === null) return plain(<Gone title="No such pass" text="This pass isn’t in the prediction for your location." />);
  if (pass === undefined || wantPractice) return plain(<p className="muted">Working out the pass…</p>);
  // Back to the pass page, in place of this screen, so back from there goes where you came from.
  const toPass = () => navigate({ name: 'pass', passId: id }, { replace: true });

  return (
    <ClockContext.Provider value={practice?.clock ?? systemClock}>
      <LiveScreen
        key={practice ? `practice-${practice.run}` : 'live'}
        pass={pass}
        sat={sat}
        location={location}
        station={toV1Station(station)}
        onStation={(v1) => void store.updateStation(fromV1Station(v1, station))}
        onClose={goUp}
        onLog={(q) => store.logQso({ ...q, passId: practice ? null : id })}
        onRecorded={(r) => void saveRecording({ ...r, passId: id })}
        onPractice={() => setPractice((p) => ({ clock: new SimulatedClock(pass.aos - 60 * SECOND, 1), rate: 1, run: (p?.run ?? 0) + 1 }))}
        onReviewLog={toPass}
        onAddContacts={toPass}
        onNext={() => navigate({ name: 'now' }, { replace: true })}
        practice={practice ? { rate: practice.rate, onRate: (rate) => setPractice((p) => p && { ...p, clock: new SimulatedClock(p.clock.now(), rate), rate }) } : undefined}
      />
    </ClockContext.Provider>
  );
}
