import { useEffect, useRef, useState } from 'react';
import { formatMHz, formatOffsetKHz } from '../model/freq';
import { formatUtc } from '../model/format';
import { PRACTICE_RATES, tuningVerdict, type PracticeRate } from '../model/practice';
import { exactAt, type RetuneSchedule } from '../model/schedule';
import type { TrackPoint } from '../model/track';
import type { RadioStepHz, Transmitter } from '../model/types';
import { PracticeTone } from '../practice/tone';
import { Button, Segmented, Tag } from '../ui/common';
import { Icon } from '../ui/icons';

export interface PracticeControls {
  rate: PracticeRate;
  onRate: (r: PracticeRate) => void;
}

const VERDICT = {
  on: { text: 'On frequency', tone: 'ok' },
  close: { text: 'Drifting — retune', tone: 'warn' },
  off: { text: 'Off frequency', tone: 'danger' },
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
    <section role="region" aria-label="Practice" className="panel stack" style={{ borderStyle: 'dashed', borderColor: 'var(--amber)' }}>
      <div className="lcd-line">
        <h2 className="section-title" style={{ margin: 0 }}>
          Practice
        </h2>
        <span className="hint mono">{formatUtc(now, true)} (simulated)</span>
      </div>
      <Segmented<PracticeRate>
        label="Speed"
        value={controls.rate}
        onChange={controls.onRate}
        options={PRACTICE_RATES.map((r) => ({ value: r, label: `${r}×` }))}
      />
      <div>
        <p className="silk">Your radio’s {side === 'downlink' ? 'listen' : 'transmit'} dial</p>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 6 }}>
          <Button expand="inline" size="large" className="key-icon" onClick={() => turn(-stepHz)} aria-label="Tune down one step">
            <Icon name="chevronDown" />
          </Button>
          <span className="lcd readout readout-l" style={{ flex: 1, textAlign: 'center' }}>
            {formatMHz(dialHz)}
          </span>
          <Button expand="inline" size="large" className="key-icon" onClick={() => turn(stepHz)} aria-label="Tune up one step">
            <Icon name="chevronUp" />
          </Button>
        </div>
        <div role="status" style={{ textAlign: 'center', marginTop: 10 }}>
          {verdict ? (
            <Tag tone={verdict.tone}>
              {verdict.text} <span className="mono">({formatOffsetKHz(errorHz ?? 0)})</span>
            </Tag>
          ) : (
            <span className="hint">Below the horizon — nothing to hear yet</span>
          )}
        </div>
      </div>
      {PracticeTone.supported() && (
        <Button
          aria-pressed={listening}
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
          <Icon name={listening ? 'volumeOn' : 'volumeOff'} />
          {listening ? 'Practice tone on' : 'Hear the practice tone'}
        </Button>
      )}
      <p className="hint">
        The tone stands in for the satellite: clean when you’re on frequency, buried in noise as it drifts. Retune when it
        starts to fizz.
      </p>
    </section>
  );
}
