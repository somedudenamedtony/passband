import { useEffect, useRef, useState } from 'react';
import { formatMHz, formatOffsetKHz } from '../model/freq';
import { formatUtc } from '../model/format';
import { PRACTICE_RATES, tuningVerdict, type PracticeRate } from '../model/practice';
import { exactAt, type RetuneSchedule } from '../model/schedule';
import type { TrackPoint } from '../model/track';
import type { RadioStepHz, Transmitter } from '../model/types';
import { PracticeTone } from '../practice/tone';
import { Button, Segmented } from '../ui/common';

export interface PracticeControls {
  rate: PracticeRate;
  onRate: (r: PracticeRate) => void;
}

const VERDICT = {
  on: { text: 'On frequency', cls: 'bg-accent text-accent-fg' },
  close: { text: 'Drifting — retune', cls: 'bg-warn-bg text-warn-fg' },
  off: { text: 'Off frequency', cls: 'bg-danger-bg text-danger-fg' },
} as const;

/**
 * D16: the only thing practice adds to the live screen — a speed control and a radio dial for the
 * side you retune, with a synthetic tone that sounds the way your tuning would.
 */
export function PracticePanel({
  controls,
  tx,
  schedule,
  here,
  up,
  now,
  stepHz,
}: {
  controls: PracticeControls;
  tx: Transmitter;
  schedule: RetuneSchedule | null;
  here: TrackPoint | null;
  up: boolean;
  now: number;
  stepHz: RadioStepHz;
}) {
  const side = schedule?.tuneSide ?? (tx.downlinkHz !== null ? 'downlink' : 'uplink');
  const first = schedule?.steps[0];
  const startHz = (side === 'downlink' ? (first?.downlinkHz ?? tx.downlinkHz) : (first?.uplinkHz ?? tx.uplinkHz)) ?? 0;
  const [dialHz, setDialHz] = useState(startHz);
  const touched = useRef(false);
  // The schedule arrives after the first render; start the dial where the screen says to start,
  // unless the user has already turned it.
  useEffect(() => {
    if (!touched.current) setDialHz(startHz);
  }, [startHz]);
  const turn = (delta: number) => {
    touched.current = true;
    setDialHz((h) => h + delta);
  };
  const [listening, setListening] = useState(false);
  const tone = useRef<PracticeTone | null>(null);

  const exact = here ? exactAt(tx, here.rangeRateMps) : null;
  const targetHz = side === 'downlink' ? exact?.downlinkHz : exact?.uplinkHz;
  const errorHz = up && targetHz != null ? dialHz - targetHz : null;

  useEffect(() => {
    tone.current?.update(errorHz);
  }, [errorHz]);
  useEffect(() => () => tone.current?.stop(), []);

  const verdict = errorHz === null ? null : VERDICT[tuningVerdict(errorHz)];

  return (
    <section aria-label="Practice" className="my-3 space-y-3 rounded-2xl border-2 border-dashed border-accent p-3">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold">Practice</h2>
        <span className="tabular text-sm text-muted">{formatUtc(now, true)} (simulated)</span>
      </div>
      <Segmented<PracticeRate>
        label="Speed"
        value={controls.rate}
        onChange={controls.onRate}
        options={PRACTICE_RATES.map((r) => ({ value: r, label: `${r}×` }))}
      />
      <div>
        <div className="mb-1 text-sm text-muted">
          Your radio’s {side === 'downlink' ? 'listen' : 'transmit'} dial
        </div>
        <div className="tabular flex items-center gap-2">
          <Button onClick={() => turn(-stepHz)} className="text-2xl" aria-label="Tune down one step">
            ▼
          </Button>
          <span className="flex-1 text-center text-3xl font-black">{formatMHz(dialHz)}</span>
          <Button onClick={() => turn(stepHz)} className="text-2xl" aria-label="Tune up one step">
            ▲
          </Button>
        </div>
        <div className={`mt-2 rounded-lg px-3 py-2 text-center font-bold ${verdict ? verdict.cls : 'bg-surface text-muted'}`} role="status">
          {verdict ? (
            <>
              {verdict.text} <span className="font-normal">({formatOffsetKHz(errorHz ?? 0)})</span>
            </>
          ) : (
            'Below the horizon — nothing to hear yet'
          )}
        </div>
      </div>
      {PracticeTone.supported() && (
        <Button
          className="w-full"
          kind={listening ? 'primary' : 'secondary'}
          onClick={() => {
            if (listening) {
              tone.current?.stop();
              tone.current = null;
            } else {
              tone.current = new PracticeTone();
              tone.current.start();
              tone.current.update(errorHz);
            }
            setListening(!listening);
          }}
        >
          {listening ? '🔊 Practice tone on' : '🔇 Hear the practice tone'}
        </Button>
      )}
      <p className="text-sm text-muted">
        The tone stands in for the satellite: clean when you’re on frequency, buried in noise as it drifts. Retune when it
        starts to fizz.
      </p>
    </section>
  );
}
