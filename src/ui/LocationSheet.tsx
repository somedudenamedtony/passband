import { useState } from 'react';
import type { Location, Station } from '../model/types';
import { Button, Panel, Sheet, useConfirm } from './common';
import { Icon } from './icons';
import { LocationForm } from './LocationSetup';
import { MaskEditor } from './MaskEditor';

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
  const [confirm, confirmNode] = useConfirm();

  const askDelete = (l: Location) =>
    confirm({ title: `Delete ${l.name}?`, message: 'Its horizon mask goes with it. Logged contacts are kept.', onConfirm: () => onDelete(l.id) });

  return (
    <Sheet title="Locations" onClose={onClose}>
      <Panel>
        <ul className="rows">
          {locations.map((l) => (
            <li key={l.id} className="row" aria-current={l.id === activeId}>
              <span className="row-main">
                <span className="row-title" style={{ display: 'block' }}>
                  {l.name}
                </span>
                <span className="row-sub mono">
                  {l.grid6}
                  {l.horizonMask.some((m) => m > 0) && ' · horizon mask set'}
                </span>
              </span>
              {l.id === activeId ? (
                <span className="tag tag-warn" aria-label="In use">
                  In use
                </span>
              ) : (
                <Button expand="inline" size="small" onClick={() => onSelect(l.id)} aria-label={`Use ${l.name}`}>
                  Use
                </Button>
              )}
              <Button expand="inline" size="small" kind="ghost" onClick={() => setMasking(l)} aria-label={`Horizon mask for ${l.name}`}>
                Horizon
              </Button>
              {locations.length > 1 && (
                <Button expand="inline" size="small" kind="ghost" className="key-icon" onClick={() => askDelete(l)} aria-label={`Delete ${l.name}`}>
                  <Icon name="trash" />
                </Button>
              )}
            </li>
          ))}
        </ul>
      </Panel>
      <div style={{ marginTop: 14 }}>
        {adding ? <LocationForm onSave={onAdd} submitLabel="Add location" /> : <Button onClick={() => setAdding(true)}>Add a location</Button>}
      </div>
      <p className="hint" style={{ marginTop: 12 }}>
        Add the park, a hilltop, or a grid you plan to rove to. Passes are predicted for whichever is selected.
      </p>
      {confirmNode}
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
