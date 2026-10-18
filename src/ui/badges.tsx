import type { Satellite, Status } from '../model/types';
import { Tag } from './common';

export function StatusBadge({ status }: { status: Status }) {
  if (status === 'active') return null;
  return <Tag tone={status === 'inactive' ? 'danger' : 'warn'}>{status === 'inactive' ? 'Inactive' : 'Status unknown'}</Tag>;
}

const DIFFICULTY = { beginner: 'Easy', intermediate: 'Intermediate', advanced: 'Advanced' } as const;

export function DifficultyBadge({ sat }: { sat: Satellite }) {
  const d = sat.overlay.difficulty;
  return <Tag tone={d === 'beginner' ? 'ok' : 'plain'}>{d ? DIFFICULTY[d] : 'Difficulty unknown'}</Tag>;
}
