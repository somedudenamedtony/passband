import { angleDiff, pointingHint, type Pointing } from '../model/orientation';

/** Big arrow and words: where to move the antenna from where the phone's top edge points. */
export function PointingGuide({ target, device }: { target: Pointing; device: Pointing }) {
  const hint = pointingHint(target, device);
  const rel = angleDiff(target.azDeg, device.azDeg);
  return (
    <div className="lcd" style={{ display: 'flex', alignItems: 'center', gap: 16 }} role="status" aria-label="Pointing">
      <svg viewBox="-50 -50 100 100" style={{ width: 96, height: 96, flex: 'none' }} aria-hidden>
        <circle r={46} fill="none" stroke="var(--border)" strokeWidth={3} />
        <g transform={`rotate(${rel})`}>
          <path d="M0,-40 L16,-6 L6,-6 L6,30 L-6,30 L-6,-6 L-16,-6 Z" fill={hint ? 'var(--fg)' : 'var(--accent)'} />
        </g>
      </svg>
      <div className="readout readout-m">
        {hint ? (
          <>
            {Math.abs(hint.turn) > 8 && (
              <div>
                Turn {hint.turn > 0 ? 'right' : 'left'} {Math.round(Math.abs(hint.turn))}°
              </div>
            )}
            {Math.abs(hint.raise) > 8 && (
              <div>
                {hint.raise > 0 ? 'Raise' : 'Lower'} {Math.round(Math.abs(hint.raise))}°
              </div>
            )}
          </>
        ) : (
          <div>On target</div>
        )}
        <div className="muted" style={{ fontSize: '0.85rem', fontFamily: 'var(--sans)' }}>Point the top of the phone along your antenna</div>
      </div>
    </div>
  );
}
