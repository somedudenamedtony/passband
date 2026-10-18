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
      <div className="space-y-4">
        <p className="text-sm text-muted">
          The lowest elevation you can see over trees and buildings, all the way round. Passes are judged on the part
          above it.
        </p>
        <SkyPlot track={[]} now={null} mask={mask} />

        {sweeping ? (
          <div className="space-y-2">
            <div className="relative aspect-[3/4] w-full overflow-hidden rounded-2xl bg-black">
              <video ref={videoRef} playsInline muted className="absolute inset-0 h-full w-full object-cover" />
              <div className="absolute inset-x-0 top-1/2 h-0.5 bg-white/80" />
              <p className="tabular absolute inset-x-0 bottom-0 bg-black/60 px-3 py-2 text-center text-white">
                {cam ? `${compassPoint(cam.azDeg)} ${Math.round(cam.azDeg)}° · ${Math.round(cam.elDeg)}° up` : 'Waiting for the compass…'}
                {camState === 'denied' && ' · camera refused, sweep still works'}
              </p>
            </div>
            <p className="text-sm">Hold the phone upright, put the line on the treetops, and turn slowly all the way round.</p>
            <CompassStatus compass={compass} station={station} now={now} />
            <Button kind="primary" className="w-full" onClick={stopSweep}>
              Done sweeping
            </Button>
          </div>
        ) : (
          <Button className="w-full" onClick={() => setSweeping(true)}>
            Sweep the horizon with the camera
          </Button>
        )}

        <details>
          <summary className="min-h-12 cursor-pointer font-semibold">Adjust by hand</summary>
          <ul className="tabular space-y-1">
            {mask.map((m, i) => (
              <li key={i} className="flex items-center gap-2">
                <span className="w-16 text-sm">
                  {compassPoint(i * 10 + 5)} {i * 10}°
                </span>
                <input
                  type="range"
                  min={0}
                  max={MAX_MASK}
                  value={m}
                  aria-label={`Minimum elevation from ${i * 10}° to ${i * 10 + 10}°`}
                  onChange={(e) => setMask((cur) => cur.map((v, j) => (j === i ? Number(e.target.value) : v)))}
                  className="h-10 flex-1"
                />
                <span className="w-10 text-right text-sm">{m}°</span>
              </li>
            ))}
          </ul>
        </details>

        <div className="flex gap-2">
          <Button className="flex-1" onClick={() => setMask(mask.map(() => 0))}>
            Clear
          </Button>
          <Button kind="primary" className="flex-1" onClick={() => onSave({ ...location, horizonMask: mask })}>
            Save
          </Button>
        </div>
      </div>
    </Sheet>
  );
}
