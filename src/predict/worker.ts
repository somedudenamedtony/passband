// D3: one worker owns propagation. The UI asks it for passes.

import type { Location, Pass } from '../model/types';
import { findPasses, satrecFromOmm, lookAngle, rangeRate, type PassSearch } from './passes';

export type WorkerRequest =
  | { id: number; type: 'passes'; sats: PassSearch[]; location: Location; from: number; to: number }
  | { id: number; type: 'rangeRate'; sat: PassSearch; location: Location; t: number };

export type WorkerResponse =
  | { id: number; type: 'passes'; passes: Pass[] }
  | { id: number; type: 'rangeRate'; rangeRateMps: number | null; elDeg: number | null }
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
