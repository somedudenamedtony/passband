import { ACTIVITIES, type Activity } from '../model/activity';
import { db } from './db';

export type SatScope = 'favorites' | 'recommended' | 'all' | 'inactive';
export interface Browsing {
  scope: SatScope;
  activities: Activity[];
  query: string;
}
export const DEFAULT_BROWSING: Browsing = { scope: 'recommended', activities: [], query: '' };

export async function loadBrowsing(): Promise<Browsing> {
  const saved = await (await db()).get('settings', 'browsing') as Partial<Browsing> | undefined;
  return {
    scope: ['favorites', 'recommended', 'all', 'inactive'].includes(saved?.scope ?? '') ? saved!.scope! : 'recommended',
    activities: Array.isArray(saved?.activities) ? saved.activities.filter((id) => ACTIVITIES.some((a) => a.id === id)) : [],
    query: typeof saved?.query === 'string' ? saved.query : '',
  };
}
export async function saveBrowsing(value: Browsing): Promise<void> {
  await (await db()).put('settings', value, 'browsing');
}
