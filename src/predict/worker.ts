// D3: one worker owns propagation. The UI asks it for passes.

import type { Location, Pass } from '../model/types';
import type { TrackPoint } from '../model/track';
import { findPasses, satrecFromOmm, lookAngle, passTrack, rangeRate, subPoint, type PassSearch } from './passes';

export interface GroundPoint {
  t: number;
  latDeg: number;
  lonDeg: number;
  altM: number;
}

export type WorkerRequest =
  | { id: number; type: 'passes'; sats: PassSearch[]; location: Location; from: number; to: number }
  | { id: number; type: 'rangeRate'; sat: PassSearch; location: Location; t: number }
  | { id: number; type: 'track'; sat: PassSearch; location: Location; aos: number; los: number }
  | { id: number; type: 'ground'; sat: PassSearch; from: number; to: number; stepMs: number };

export type WorkerResponse =
  | { id: number; type: 'passes'; passes: Pass[] }
  | { id: number; type: 'rangeRate'; rangeRateMps: number | null; elDeg: number | null }
  | { id: number; type: 'track'; track: TrackPoint[] }
  | { id: number; type: 'ground'; points: GroundPoint[] }
  | { id: number; type: 'error'; message: string };

self.onmessage = (ev: MessageEvent<WorkerRequest>) => {
  const req = ev.data;
  try {
    if (req.type === 'passes') {
      const passes: Pass[] = [];
      for (const s of req.sats) {
        try {
          passes.push(...findPasses(s, req.location, req.from, req.to));
        } catch {
          // Bad elements for one satellite shouldn't hide everyone else's passes.
        }
      }
      passes.sort((a, b) => a.aos - b.aos);
      post({ id: req.id, type: 'passes', passes });
    } else if (req.type === 'ground') {
      const satrec = satrecFromOmm(req.sat.elements);
      const points: GroundPoint[] = [];
      for (let t = req.from; t <= req.to; t += req.stepMs) {
        const p = subPoint(satrec, t);
        if (p) points.push({ t, ...p });
      }
      post({ id: req.id, type: 'ground', points });
    } else if (req.type === 'track') {
      post({ id: req.id, type: 'track', track: passTrack(req.sat.elements, req.location, req.aos, req.los) });
    } else {
      const satrec = satrecFromOmm(req.sat.elements);
      post({
        id: req.id,
        type: 'rangeRate',
        rangeRateMps: rangeRate(satrec, req.location, req.t),
        elDeg: lookAngle(satrec, req.location, req.t)?.elDeg ?? null,
      });
    }
  } catch (err) {
    post({ id: req.id, type: 'error', message: (err as Error).message });
  }
};

function post(msg: WorkerResponse) {
  self.postMessage(msg);
}
