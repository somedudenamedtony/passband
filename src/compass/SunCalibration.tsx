// D10: sun calibration. The app knows where the sun is; the user lines the phone up with it (or
// its shadow) and taps. The offset fixes what a magnetic model can't, like a metal antenna boom.

import { useState } from 'react';
import { angleDiff, normaliseAz } from '../model/orientation';
import { compassWord } from '../model/format';
import { sunPosition } from '../model/sun';
import type { Location, Station } from '../model/types';
import { Banner, Button, Segmented, Sheet } from '../ui/common';
import { useNow } from '../ui/clock';
import { CompassStatus } from './CompassStatus';
import { useCompass } from './useCompass';

export function SunCalibration({
  location,
  station,
  onChange,
  onClose,
}: {
  location: Location;
  station: Station;
  onChange: (s: Station) => void;
  onClose: () => void;
}) {
  const now = useNow(1000);
  const compass = useCompass(location, station);
  const [mode, setMode] = useState<'sun' | 'shadow'>('sun');
  const sun = sunPosition(now, location.latDeg, location.lonDeg);
  const target = mode === 'sun' ? sun.azDeg : normaliseAz(sun.azDeg + 180);
  const raw = compass.reading?.topUncalibrated.azDeg;
  const shown = compass.reading?.top.azDeg;

  return (
    <Sheet title="Calibrate the compass" onClose={onClose}>
      <div className="stack">
        {sun.elDeg < 2 ? (
          <Banner tone="info">The sun is below the horizon at {location.name}. Calibrate in daylight.</Banner>
        ) : (
          <>
            <p>
              The sun is in the <b>{compassWord(sun.azDeg)}</b>, at {Math.round(sun.azDeg)}°.{' '}
              {mode === 'sun'
                ? 'Hold the phone flat and point its top edge straight at the sun. Don’t look at the sun.'
                : 'Stand with the sun behind you and point the top of the phone along your shadow.'}
            </p>
            <Segmented
              label="Line up with"
              value={mode}
              onChange={setMode}
              options={[
                { value: 'sun', label: 'The sun' },
                { value: 'shadow', label: 'My shadow' },
              ]}
            />
          </>
        )}
        <CompassStatus compass={compass} station={station} now={now} />
        {shown !== undefined && (
          <p className="readout center" style={{ fontSize: '1.15rem' }}>
            Phone points {Math.round(shown)}° · target {Math.round(target)}° · off by {Math.round(Math.abs(angleDiff(target, shown)))}°
          </p>
        )}
        <Button
          kind="primary"
          disabled={raw === undefined || sun.elDeg < 2}
          onClick={() => {
            if (raw === undefined) return;
            onChange({ ...station, compassOffsetDeg: angleDiff(target, raw), compassCalibratedAt: now });
            onClose();
          }}
        >
          It’s lined up — set
        </Button>
        {station.compassCalibratedAt !== null && (
          <Button
              onClick={() => onChange({ ...station, compassOffsetDeg: 0, compassCalibratedAt: null })}
          >
            Clear calibration ({station.compassOffsetDeg > 0 ? '+' : ''}
            {station.compassOffsetDeg.toFixed(0)}°)
          </Button>
        )}
        <p className="hint">Calibrate where you’ll operate, holding the phone the way you will during a pass.</p>
      </div>
    </Sheet>
  );
}
