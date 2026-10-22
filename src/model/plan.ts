// SPEC-v2 D25: a plan is a promise to yourself to try a pass. Kept on the device (D1).

import type { PassId } from './passId';

export type PlanOutcome = 'planned' | 'worked' | 'heard' | 'missed';

export interface Plan {
  id: PassId;
  noradId: number;
  /** Copied from the pass so the plan survives re-prediction. UTC epoch ms. */
  aos: number;
  los: number;
  locationId: string;
  /** Which transmitter you mean to work; null until chosen. */
  transmitterId: string | null;
  note: string;
  outcome: PlanOutcome;
  createdAt: number;
}

/** SPEC-v2 D25: plans whose windows overlap another plan's. You can only point at one bird. */
export function clashingIds(plans: readonly Pick<Plan, 'id' | 'aos' | 'los' | 'outcome'>[]): Set<string> {
  const live = plans.filter((p) => p.outcome === 'planned').slice().sort((a, b) => a.aos - b.aos);
  const out = new Set<string>();
  for (let i = 0; i < live.length; i++) {
    for (let j = i + 1; j < live.length && live[j]!.aos < live[i]!.los; j++) {
      out.add(live[i]!.id);
      out.add(live[j]!.id);
    }
  }
  return out;
}
