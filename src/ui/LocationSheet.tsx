import { useState } from 'react';
import type { Location, Station } from '../model/types';
import { MaskEditor } from './MaskEditor';
import { Button, Sheet } from './common';
import { LocationForm } from './LocationSetup';

export function LocationSheet({
  locations,
  activeId,
  onSelect,
  onAdd,
  onDelete,
  onUpdate,
  station,
  onClose,
}: {
  locations: Location[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onAdd: (l: Location) => void;
  onDelete: (id: string) => void;
  onUpdate: (l: Location) => void;
  station: Station;
  onClose: () => void;
}) {
  const [adding, setAdding] = useState(false);
  const [masking, setMasking] = useState<Location | null>(null);
  return (
    <Sheet title="Locations" onClose={onClose}>
      <ul className="mb-4 space-y-2">
        {locations.map((l) => (
          <li key={l.id} className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => onSelect(l.id)}
              aria-current={l.id === activeId}
              className={`min-h-12 flex-1 rounded-xl border px-4 text-left ${
                l.id === activeId ? 'border-accent bg-surface font-bold' : 'border-line'
              }`}
            >
              {l.name} <span className="text-muted">· {l.grid6}</span>
              {l.horizonMask.some((m) => m > 0) && <span className="block text-xs text-muted">horizon mask set</span>}
            </button>
            <button
              type="button"
              onClick={() => setMasking(l)}
              className="min-h-12 rounded-xl border border-line px-3 text-sm font-semibold"
              aria-label={`Horizon mask for ${l.name}`}
            >
              Horizon
            </button>
            {locations.length > 1 && (
              <button
                type="button"
                onClick={() => {
                  if (confirm(`Delete ${l.name}?`)) onDelete(l.id);
                }}
                className="min-h-12 min-w-12 rounded-xl border border-line text-muted"
                aria-label={`Delete ${l.name}`}
              >
                🗑
              </button>
            )}
          </li>
        ))}
      </ul>
      {adding ? (
        <LocationForm onSave={onAdd} submitLabel="Add location" />
      ) : (
        <Button onClick={() => setAdding(true)} className="w-full">
          Add a location
        </Button>
      )}
      <p className="mt-3 text-sm text-muted">
        Add the park, a hilltop, or a grid you plan to rove to. Passes are predicted for whichever is selected.
      </p>
      {masking && (
        <MaskEditor
          location={masking}
          station={station}
          onClose={() => setMasking(null)}
          onSave={(l) => {
            onUpdate(l);
            setMasking(null);
          }}
        />
      )}
    </Sheet>
  );
}
