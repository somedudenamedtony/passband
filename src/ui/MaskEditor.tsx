// D9: 36 numbers per location — a slider per 10° sector, or sweep mode: hold the phone up and pan
// along the treeline while the compass and tilt sensor record it.

import { useEffect, useRef, useState } from 'react';
import { useCamera } from '../compass/useCamera';
import { useCompass } from '../compass/useCompass';
import { CompassStatus } from '../compass/CompassStatus';
import { SkyPlot } from '../live/SkyPlot';
import { compassPoint } from '../model/format';
import { foldSweep, type Pointing } from '../model/orientation';
import type { Location, Station } from '../model/types';
import { Button, Sheet } from './common';
import { IonAccordion, IonAccordionGroup, IonIcon, IonItem, IonLabel, IonList, IonNote } from '@ionic/react';
import { cameraOutline } from 'ionicons/icons';
import { useNow } from './clock';

const MAX_MASK = 45;

export function MaskEditor({
  location,
  station,
  onSave,
  onClose,
}: {
  location: Location;
  station: Station;
  onSave: (l: Location) => void;
  onClose: () => void;
}) {
  const [mask, setMask] = useState<number[]>(() => [...location.horizonMask]);
  const [sweeping, setSweeping] = useState(false);
  const now = useNow(1000);
  const compass = useCompass(location, station, sweeping);
  const { videoRef, state: camState } = useCamera(sweeping);
  const samples = useRef<Pointing[]>([]);
  const cam = compass.reading?.camera;

  useEffect(() => {
    if (sweeping && cam) samples.current.push(cam);
  }, [sweeping, cam]);

  function stopSweep() {
    setMask((m) => foldSweep(m, samples.current));
    samples.current = [];
    setSweeping(false);
  }

  return (
    <Sheet title={`Horizon at ${location.name}`} onClose={onClose}>
      <div className="stack">
        <IonNote style={{ display: 'block' }}>
          The lowest elevation you can see over trees and buildings, all the way round. Passes are judged on the part
          above it.
        </IonNote>
        <SkyPlot track={[]} now={null} mask={mask} />

        {sweeping ? (
          <div className="stack">
            <div className="ar-view">
              <video ref={videoRef} playsInline muted />
              <div style={{ position: 'absolute', left: 0, right: 0, top: '50%', height: 2, background: 'rgba(255,255,255,0.8)' }} />
              <p className="ar-note tabular" style={{ fontSize: '0.9rem', padding: 8 }}>
                {cam ? `${compassPoint(cam.azDeg)} ${Math.round(cam.azDeg)}° · ${Math.round(cam.elDeg)}° up` : 'Waiting for the compass…'}
                {camState === 'denied' && ' · camera refused, sweep still works'}
              </p>
            </div>
            <p>Hold the phone upright, put the line on the treetops, and turn slowly all the way round.</p>
            <CompassStatus compass={compass} station={station} now={now} />
            <Button kind="primary" onClick={stopSweep}>
              Done sweeping
            </Button>
          </div>
        ) : (
          <Button onClick={() => setSweeping(true)}>
            <IonIcon slot="start" icon={cameraOutline} aria-hidden />
            Sweep the horizon with the camera
          </Button>
        )}

        <IonAccordionGroup>
          <IonAccordion value="hand">
            <IonItem slot="header">
              <IonLabel>Adjust by hand</IonLabel>
            </IonItem>
            <IonList slot="content" className="tabular">
              {mask.map((m, i) => (
                <IonItem key={i} lines="none">
                  <IonLabel style={{ flex: '0 0 72px' }}>
                    {compassPoint(i * 10 + 5)} {i * 10}°
                  </IonLabel>
                  <input
                    type="range"
                    min={0}
                    max={MAX_MASK}
                    value={m}
                    aria-label={`Minimum elevation from ${i * 10}° to ${i * 10 + 10}°`}
                    onChange={(e) => setMask((cur) => cur.map((v, j) => (j === i ? Number(e.target.value) : v)))}
                    style={{ flex: 1, accentColor: 'var(--ion-color-primary)', minHeight: 40 }}
                  />
                  <IonNote slot="end" style={{ width: 36, textAlign: 'right' }}>
                    {m}°
                  </IonNote>
                </IonItem>
              ))}
            </IonList>
          </IonAccordion>
        </IonAccordionGroup>

        <div style={{ display: 'flex', gap: 8 }}>
          <Button expand={undefined} className="ion-flex-1" onClick={() => setMask(mask.map(() => 0))}>
            Clear
          </Button>
          <Button kind="primary" expand={undefined} className="ion-flex-1" onClick={() => onSave({ ...location, horizonMask: mask })}>
            Save
          </Button>
        </div>
      </div>
    </Sheet>
  );
}
