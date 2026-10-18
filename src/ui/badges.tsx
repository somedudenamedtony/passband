import type { Satellite, Status } from '../model/types';

export function StatusBadge({ status }: { status: Status }) {
  if (status === 'active') return null;
  return (
    <span
      className={`rounded-full px-2 py-0.5 text-xs font-bold ${
        status === 'inactive' ? 'bg-danger-bg text-danger-fg' : 'bg-warn-bg text-warn-fg'
      }`}
    >
      {status === 'inactive' ? 'Inactive' : 'Status unknown'}
    </span>
  );
}

const DIFFICULTY = { beginner: 'Easy', intermediate: 'Intermediate', advanced: 'Advanced' } as const;

export function DifficultyBadge({ sat }: { sat: Satellite }) {
  const d = sat.overlay.difficulty;
  return (
    <span className="rounded-full border border-line px-2 py-0.5 text-xs font-bold text-muted">
      {d ? DIFFICULTY[d] : 'Difficulty unknown'}
    </span>
  );
}
