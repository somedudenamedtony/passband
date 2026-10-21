import type { Pass } from '../model/types';
import { db } from './db';

export interface PassResult {
  id: string;
  satellite: string;
  at: number;
  outcome: 'heard' | 'nothing';
}
export function resultId(pass: Pass): string { return `${pass.locationId}:${pass.noradId}:${pass.aos}`; }
export async function listPassResults(): Promise<PassResult[]> {
  return (await (await db()).get('settings', 'passResults') as PassResult[] | undefined) ?? [];
}
export async function savePassResult(pass: Pass, satellite: string, outcome: PassResult['outcome']): Promise<void> {
  const d = await db();
  const transaction = d.transaction('settings', 'readwrite');
  const results = (await transaction.store.get('passResults') as PassResult[] | undefined) ?? [];
  const id = resultId(pass);
  await transaction.store.put([{ id, satellite, at: pass.aos, outcome }, ...results.filter((r) => r.id !== id)], 'passResults');
  await transaction.done;
}
