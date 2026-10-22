// SPEC-v2 D25: plans live in IndexedDB beside the log (D11).

import type { Plan } from '../model/plan';
import type { PassId } from '../model/passId';
import { db } from './db';

export async function savePlan(p: Plan): Promise<void> {
  await (await db()).put('plans', p);
}

export async function deletePlan(id: PassId): Promise<void> {
  await (await db()).delete('plans', id);
}

/** Soonest first. */
export async function listPlans(): Promise<Plan[]> {
  return (await db()).getAllFromIndex('plans', 'aos');
}
