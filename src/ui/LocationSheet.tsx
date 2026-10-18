import { useState } from 'react';
import type { Location } from '../model/types';
import { Button, Sheet } from './common';
import { LocationForm } from './LocationSetup';

export function LocationSheet({
  locations,
  activeId,
  onSelect,
  onAdd,
  onDelete,
  onClose,
}: {
  locations: Location[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onAdd: (l: Location) => void;
  onDelete: (id: string) => void;
  onClose: () => void;
}) {
  const [adding, setAdding] = useState(false);
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
    </Sheet>
  );
}
