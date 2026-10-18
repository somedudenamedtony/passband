// D11/D13: recordings live in IndexedDB with a per-recording delete and a storage readout.

import type { Recording } from '../model/types';
import { db } from './db';

export async function saveRecording(r: Recording): Promise<void> {
  await (await db()).put('recordings', r);
}

export async function deleteRecording(id: string): Promise<void> {
  await (await db()).delete('recordings', id);
}

/** Newest first. */
export async function listRecordings(): Promise<Recording[]> {
  return (await (await db()).getAllFromIndex('recordings', 'startedAt')).reverse();
}

export interface StorageUse {
  recordingsBytes: number;
  /** Whole-origin usage and quota, where the browser reports them. */
  usedBytes: number | null;
  quotaBytes: number | null;
}

export async function storageUse(recordings: readonly Recording[]): Promise<StorageUse> {
  const recordingsBytes = recordings.reduce((n, r) => n + r.blob.size, 0);
  try {
    const est = await navigator.storage?.estimate?.();
    return { recordingsBytes, usedBytes: est?.usage ?? null, quotaBytes: est?.quota ?? null };
  } catch {
    return { recordingsBytes, usedBytes: null, quotaBytes: null };
  }
}
