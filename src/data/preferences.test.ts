import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { db } from './db';
import { loadStation, saveStation } from './station';
import { listPassResults, savePassResult } from './passResults';
import type { Pass } from '../model/types';

beforeEach(async () => { await (await db()).clear('settings'); });

describe('saved operator choices', () => {
  it('migrates an existing station without overriding its experience or cue outputs', async () => {
    await (await db()).put('settings', { experience: 'experienced', callsign: 'W7LIT', cues: { speech: false } }, 'station');
    const station = await loadStation();
    expect(station).toMatchObject({ experience: 'experienced', goal: 'contacts', equipment: 'unknown', showTips: null, callsign: 'W7LIT', cues: { speech: false, tones: false } });
    await saveStation({ ...station, showTips: true, compactDetails: false, liveCues: false, liveView: 'sky' });
    expect(await loadStation()).toMatchObject({ showTips: true, compactDetails: false, liveCues: false, liveView: 'sky' });
  });

  it('records one listening result per pass and keeps locations distinct', async () => {
    const pass = { locationId: 'home', noradId: 1, aos: 1000 } as Pass;
    await savePassResult(pass, 'Test', 'nothing');
    await savePassResult(pass, 'Test', 'heard');
    await savePassResult({ ...pass, locationId: 'park' }, 'Test', 'heard');
    const results = await listPassResults();
    expect(results).toHaveLength(2);
    expect(results.every((r) => r.outcome === 'heard')).toBe(true);
  });
});
