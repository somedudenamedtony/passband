// §5.2 AR toggle: the satellite's position and an arrow over the camera view (D10).

import { useCamera } from '../compass/useCamera';
import type { Compass } from '../compass/useCompass';
import { angleDiff, projectToScreen, type Pointing } from '../model/orientation';
import type { TrackPoint } from '../model/track';

// Typical phone main camera in portrait. Approximate — the overlay says so.
const H_FOV = 50;
const V_FOV = 66;

export function ARView({ compass, sat, track }: { compass: Compass; sat: Pointing | null; track: readonly TrackPoint[] }) {
  const { videoRef, state } = useCamera(true);
  const cam = compass.reading?.camera ?? null;
  const proj = cam && sat ? projectToScreen(sat, cam, H_FOV, V_FOV) : null;
  const trackPts = cam
    ? track
        .filter((_, i) => i % 10 === 0)
        .map((p) => projectToScreen(p, cam, H_FOV, V_FOV))
        .filter((p) => p.x > -0.2 && p.x < 1.2 && p.y > -0.2 && p.y < 1.2)
    : [];
  const edgeAngle = cam && sat ? Math.atan2(-(sat.elDeg - cam.elDeg), angleDiff(sat.azDeg, cam.azDeg)) : 0;

  return (
    <div className="ar-view" aria-label="AR view">
      <video ref={videoRef} playsInline muted />
      {state !== 'on' && (
        <p className="ar-center">
          {state === 'denied' ? 'Camera access was refused.' : state === 'unsupported' ? 'No camera available.' : 'Starting the camera…'}
        </p>
      )}
      <svg viewBox="0 0 100 133" preserveAspectRatio="none">
        {trackPts.length > 1 && (
          <polyline
            points={trackPts.map((p) => `${p.x * 100},${p.y * 133}`).join(' ')}
            fill="none"
            stroke="#5ea2ff"
            strokeWidth={1.2}
            strokeDasharray="3 2"
          />
        )}
        {proj?.inView && (
          <g transform={`translate(${proj.x * 100},${proj.y * 133})`}>
            <circle r={6} fill="none" stroke="#fff" strokeWidth={1.5} />
            <circle r={2} fill="#fff" />
          </g>
        )}
        {proj && !proj.inView && (
          <g transform={`translate(50,66.5) rotate(${(edgeAngle * 180) / Math.PI})`}>
            <path d="M30,0 L18,-8 L18,8 Z" fill="#fff" stroke="#000" strokeWidth={0.5} />
          </g>
        )}
        <line x1={47} x2={53} y1={66.5} y2={66.5} stroke="#fff" strokeWidth={0.5} />
        <line x1={50} x2={50} y1={63.5} y2={69.5} stroke="#fff" strokeWidth={0.5} />
      </svg>
      <p className="ar-note">
        {compass.status !== 'ok'
          ? 'AR needs the compass.'
          : sat && sat.elDeg < 0
            ? 'Below the horizon — the marker shows where it will rise.'
            : 'Approximate: trust the numbers over the overlay.'}
      </p>
    </div>
  );
}
