import type { TrackPoint } from '../model/track';
import type { Location, Pass, Satellite } from '../model/types';
import type { PassSearch } from './passes';
import type { GroundPoint, WorkerRequest, WorkerResponse } from './worker';

type Pending = { resolve: (r: WorkerResponse) => void; reject: (e: Error) => void };

let worker: Worker | null = null;
let nextId = 1;
const pending = new Map<number, Pending>();

function getWorker(): Worker {
  if (worker) return worker;
  worker = new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' });
  worker.onmessage = (ev: MessageEvent<WorkerResponse>) => {
    const p = pending.get(ev.data.id);
    if (!p) return;
    pending.delete(ev.data.id);
    if (ev.data.type === 'error') p.reject(new Error(ev.data.message));
    else p.resolve(ev.data);
  };
  return worker;
}

type Req = WorkerRequest extends infer R ? (R extends WorkerRequest ? Omit<R, 'id'> : never) : never;

function ask(req: Req): Promise<WorkerResponse> {
  const id = nextId++;
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject });
    getWorker().postMessage({ ...req, id } as WorkerRequest);
  });
}

function toSearch(s: Satellite): PassSearch {
  return { noradId: s.noradId, elements: s.elements, elementsEpoch: s.elementsEpoch };
}

export async function predictPasses(sats: Satellite[], location: Location, from: number, to: number): Promise<Pass[]> {
  const r = await ask({ type: 'passes', sats: sats.map(toSearch), location, from, to });
  return r.type === 'passes' ? r.passes : [];
}

export async function rangeRateAt(sat: Satellite, location: Location, t: number): Promise<number | null> {
  const r = await ask({ type: 'rangeRate', sat: toSearch(sat), location, t });
  return r.type === 'rangeRate' ? r.rangeRateMps : null;
}

export async function passTrackFor(sat: Satellite, location: Location, pass: Pass): Promise<TrackPoint[]> {
  const r = await ask({ type: 'track', sat: toSearch(sat), location, aos: pass.aos, los: pass.los });
  return r.type === 'track' ? r.track : [];
}

export async function groundTrack(sat: Satellite, from: number, to: number, stepMs: number): Promise<GroundPoint[]> {
  const r = await ask({ type: 'ground', sat: toSearch(sat), from, to, stepMs });
  return r.type === 'ground' ? r.points : [];
}
