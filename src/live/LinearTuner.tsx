// §8.1, first step: the passband spot for a linear transponder. The radio settings above follow it
// live; this is where you choose it.

import { formatMHz } from '../model/freq';
import { LINEAR_STEP_HZ, clampToPassband, type LinearTuning, type Passband } from '../model/linear';
import { Button } from '../ui/common';

const NUDGES = [-1000, -100, 100, 1000];

export function LinearTuner({
  pb,
  tuning,
  spotHz,
  onSpot,
  isNew,
  listenOnly = false,
}: {
  pb: Passband;
  tuning: LinearTuning | null;
  spotHz: number;
  onSpot: (hz: number) => void;
  isNew: boolean;
  listenOnly?: boolean;
}) {
  const set = (hz: number) => onSpot(clampToPassband(pb, Math.round(hz / LINEAR_STEP_HZ) * LINEAR_STEP_HZ));
  return (
    <section aria-label="Passband" className="stack">
      <div className="lcd">
        <div className="lcd-line">
          <span className="lcd-label">Spot at the satellite ▼</span>
          <span className="readout readout-s">{formatMHz(spotHz)}</span>
        </div>
        {tuning && !listenOnly && (
          <div className="lcd-line">
            <span className="lcd-label">Its uplink ▲</span>
            <span className="readout readout-s">{formatMHz(tuning.upAtSatHz)}</span>
          </div>
        )}
        <input
          type="range"
          className="passband-slider"
          aria-label="Spot in the downlink passband"
          min={pb.downLowHz}
          max={pb.downHighHz}
          step={LINEAR_STEP_HZ * 10}
          value={spotHz}
          onChange={(e) => set(Number(e.target.value))}
        />
        <div className="lcd-line lcd-label" style={{ fontSize: 11 }} aria-hidden>
          <span>{formatMHz(pb.downLowHz)}</span>
          <span>{formatMHz(pb.downHighHz)}</span>
        </div>
      </div>
      <div className="key-row">
        {NUDGES.map((d) => (
          <Button key={d} size="small" onClick={() => set(spotHz + d)} aria-label={`${d > 0 ? 'Up' : 'Down'} ${Math.abs(d)} hertz`}>
            {d > 0 ? '+' : '−'}
            {Math.abs(d) >= 1000 ? `${Math.abs(d) / 1000}k` : Math.abs(d)}
          </Button>
        ))}
      </div>
      <p className="hint">
        {listenOnly ? 'Listen in USB. Choose a spot in the downlink passband, then follow the receive frequency shown above as it changes.' : <>{pb.inverting ? 'Inverting: transmit LSB to come out USB on the downlink.' : 'Non-inverting: transmit USB.'} Set TX and RX
        to the numbers above and follow them as they change; the spot at the satellite stays put, so you stay on the same
        contact.{isNew && ' Find your own signal first: send a short whistle or CW and tune until you hear it come back.'}</>}
      </p>
    </section>
  );
}
