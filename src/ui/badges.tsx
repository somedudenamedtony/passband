import { IonBadge } from '@ionic/react';
import type { Satellite, Status } from '../model/types';

export function StatusBadge({ status }: { status: Status }) {
  if (status === 'active') return null;
  return (
    <IonBadge color={status === 'inactive' ? 'danger' : 'warning'} style={{ verticalAlign: 'middle', fontSize: '0.7rem' }}>
      {status === 'inactive' ? 'Inactive' : 'Status unknown'}
    </IonBadge>
  );
}

const DIFFICULTY = { beginner: 'Easy', intermediate: 'Intermediate', advanced: 'Advanced' } as const;

export function DifficultyBadge({ sat }: { sat: Satellite }) {
  const d = sat.overlay.difficulty;
  return (
    <IonBadge color={d === 'beginner' ? 'success' : 'medium'} style={{ verticalAlign: 'middle', fontSize: '0.7rem' }}>
      {d ? DIFFICULTY[d] : 'Difficulty unknown'}
    </IonBadge>
  );
}
