import type { Station } from '../model/types';
import { db } from './db';

export const DEFAULT_STATION: Station = {
  callsign: '',
  units: 'imperial', // D20
  experience: 'new', // D19
  radioStepHz: 5000, // D7
  cues: { speech: true, tones: false, vibration: false }, // D14: speech works everywhere
  compassOffsetDeg: 0,
  compassCalibratedAt: null,
  recordPasses: false,
  hours: { fromMin: 6 * 60, toMin: 23 * 60 },
};

export async function loadStation(): Promise<Station> {
  const s = (await (await db()).get('settings', 'station')) as Partial<Station> | undefined;
  return { ...DEFAULT_STATION, ...s, cues: { ...DEFAULT_STATION.cues, ...s?.cues } };
}

export async function saveStation(s: Station): Promise<void> {
  await (await db()).put('settings', s, 'station');
}
