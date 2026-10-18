import { useEffect, useRef, useState } from 'react';
import { formatMHz, formatOffsetKHz } from '../model/freq';
import { formatUtc } from '../model/format';
import { PRACTICE_RATES, tuningVerdict, type PracticeRate } from '../model/practice';
import { exactAt, type RetuneSchedule } from '../model/schedule';
import type { TrackPoint } from '../model/track';
import type { RadioStepHz, Transmitter } from '../model/types';
import { PracticeTone } from '../practice/tone';
import { Button, Segmented } from '../ui/common';
import { IonButton, IonCard, IonCardContent, IonCardHeader, IonCardSubtitle, IonCardTitle, IonChip, IonIcon, IonNote } from '@ionic/react';
import { chevronDown, chevronUp, volumeHighOutline, volumeMuteOutline } from 'ionicons/icons';

export interface PracticeControls {
  rate: PracticeRate;
  onRate: (r: PracticeRate) => void;
}

const VERDICT = {
  on: { text: 'On frequency', color: 'success' },
  close: { text: 'Drifting — retune', color: 'warning' },
  off: { text: 'Off frequency', color: 'danger' },
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
    <IonCard role="region" aria-label="Practice" style={{ margin: 0, border: '2px dashed var(--ion-color-primary)' }}>
      <IonCardHeader>
        <IonCardSubtitle className="tabular">{formatUtc(now, true)} (simulated)</IonCardSubtitle>
        <IonCardTitle>Practice</IonCardTitle>
      </IonCardHeader>
      <IonCardContent className="stack">
        <Segmented<PracticeRate>
          label="Speed"
          value={controls.rate}
          onChange={controls.onRate}
          options={PRACTICE_RATES.map((r) => ({ value: r, label: `${r}×` }))}
        />
        <div>
          <IonNote>Your radio’s {side === 'downlink' ? 'listen' : 'transmit'} dial</IonNote>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <IonButton fill="outline" size="large" onClick={() => turn(-stepHz)} aria-label="Tune down one step">
              <IonIcon slot="icon-only" icon={chevronDown} aria-hidden />
            </IonButton>
            <span className="readout readout-l" style={{ flex: 1, textAlign: 'center', color: 'var(--fg)' }}>
              {formatMHz(dialHz)}
            </span>
            <IonButton fill="outline" size="large" onClick={() => turn(stepHz)} aria-label="Tune up one step">
              <IonIcon slot="icon-only" icon={chevronUp} aria-hidden />
            </IonButton>
          </div>
          <div role="status" style={{ textAlign: 'center', marginTop: 8 }}>
            {verdict ? (
              <IonChip color={verdict.color} style={{ fontWeight: 700 }}>
                {verdict.text}&nbsp;<span className="tabular" style={{ fontWeight: 400 }}>({formatOffsetKHz(errorHz ?? 0)})</span>
              </IonChip>
            ) : (
              <IonNote>Below the horizon — nothing to hear yet</IonNote>
            )}
          </div>
        </div>
        {PracticeTone.supported() && (
          <Button
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
            <IonIcon slot="start" icon={listening ? volumeHighOutline : volumeMuteOutline} aria-hidden />
            {listening ? 'Practice tone on' : 'Hear the practice tone'}
          </Button>
        )}
        <p>
          The tone stands in for the satellite: clean when you’re on frequency, buried in noise as it drifts. Retune when it
          starts to fizz.
        </p>
      </IonCardContent>
    </IonCard>
  );
}
