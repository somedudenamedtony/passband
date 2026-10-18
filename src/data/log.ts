// D11: the log lives in IndexedDB. The device is not a backup — export nudges live in the UI.

import type { QsoRecord } from '../model/types';
import { db } from './db';

let persistAsked = false;

/** D11: ask for persistent storage the first time something worth keeping is written. */
async function askPersist(): Promise<void> {
  if (persistAsked) return;
  persistAsked = true;
  try {
    if (navigator.storage?.persist && !(await navigator.storage.persisted())) await navigator.storage.persist();
  } catch {
    // Not fatal: the export nudge is the real safety net.
  }
}

export async function saveQso(q: QsoRecord): Promise<void> {
  await (await db()).put('qsos', q);
  void askPersist();
}

export async function deleteQso(id: string): Promise<void> {
  await (await db()).delete('qsos', id);
}

/** Newest first. */
export async function listQsos(): Promise<QsoRecord[]> {
  const all = await (await db()).getAllFromIndex('qsos', 'timeOn');
  return all.reverse();
}

export async function markExported(ids: readonly string[], at: number): Promise<void> {
  const tx = (await db()).transaction('qsos', 'readwrite');
  for (const id of ids) {
    const q = await tx.store.get(id);
    if (q) await tx.store.put({ ...q, exportedAt: at });
  }
  await tx.done;
}
