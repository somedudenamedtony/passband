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
