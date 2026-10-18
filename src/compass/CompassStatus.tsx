import { formatElementAge } from '../model/elementAge';
import type { Station } from '../model/types';
import { Button } from '../ui/common';
import type { Compass } from './useCompass';

/** D10: the compass always shows how far to trust it. */
export function CompassStatus({ compass, station, now }: { compass: Compass; station: Station; now: number }) {
  switch (compass.status) {
    case 'unsupported':
      return <p className="text-sm text-muted">No compass on this device — the sky plot stays north-up.</p>;
    case 'denied':
      return <p className="text-sm text-muted">Compass access was refused. You can allow motion access in the browser’s settings.</p>;
    case 'needs-permission':
      return (
        <Button onClick={compass.enable} className="w-full">
          Turn on the compass
        </Button>
      );
    case 'waiting':
      return <p className="text-sm text-muted">Waiting for the compass…</p>;
    case 'ok': {
      const acc = compass.reading?.accuracyDeg;
      const poor = acc != null && acc > 25;
      const cal = station.compassCalibratedAt;
      return (
        <p role="status" className={`text-sm ${poor || cal === null ? 'font-semibold' : 'text-muted'}`}>
          Compass {acc != null ? `±${Math.round(acc)}°` : 'accuracy unknown'}
          {' · '}
          {cal === null ? 'not calibrated — use sun calibration in Settings' : `sun-calibrated ${formatElementAge(cal, now).replace(' old', ' ago')}`}
          {poor && ' · move the phone in a figure 8 to settle it'}
        </p>
      );
    }
  }
}
