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
import { Button, Fold, Sheet } from './common';
import { Icon } from './icons';
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
        <p className="muted">
          The lowest elevation you can see over trees and buildings, all the way round. Passes are judged on the part
          above it.
        </p>
        <div className="panel">
          <div className="lcd sky-wrap">
            <SkyPlot track={[]} now={null} mask={mask} />
          </div>
        </div>

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
            <Icon name="camera" />
            Sweep the horizon with the camera
          </Button>
        )}

        <Fold title="Adjust by hand">
          <ul className="rows tabular">
            {mask.map((m, i) => (
              <li key={i} className="row" style={{ minHeight: 44 }}>
                <span className="mono" style={{ flex: '0 0 72px' }}>
                  {compassPoint(i * 10 + 5)} {i * 10}°
                </span>
                <input
                  type="range"
                  min={0}
                  max={MAX_MASK}
                  value={m}
                  aria-label={`Minimum elevation from ${i * 10}° to ${i * 10 + 10}°`}
                  onChange={(e) => setMask((cur) => cur.map((v, j) => (j === i ? Number(e.target.value) : v)))}
                  style={{ flex: 1, minHeight: 40 }}
                />
                <span className="row-end" style={{ width: 36 }}>
                  {m}°
                </span>
              </li>
            ))}
          </ul>
        </Fold>

        <div className="key-row">
          <Button onClick={() => setMask(mask.map(() => 0))}>
            Clear
          </Button>
          <Button kind="primary" onClick={() => onSave({ ...location, horizonMask: mask })}>
            Save
          </Button>
        </div>
      </div>
    </Sheet>
  );
}
