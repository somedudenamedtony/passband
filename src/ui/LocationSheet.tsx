import { useState } from 'react';
import {
  IonButton,
  IonIcon,
  IonItem,
  IonItemOption,
  IonItemOptions,
  IonItemSliding,
  IonLabel,
  IonList,
  IonNote,
  useIonAlert,
} from '@ionic/react';
import { checkmarkCircle, trashOutline } from 'ionicons/icons';
import type { Location, Station } from '../model/types';
import { Button, Sheet } from './common';
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
  const [confirm] = useIonAlert();

  const askDelete = (l: Location) =>
    void confirm({
      header: `Delete ${l.name}?`,
      message: 'Its horizon mask goes with it. Logged contacts are kept.',
      buttons: [
        { text: 'Cancel', role: 'cancel' },
        { text: 'Delete', role: 'destructive', handler: () => onDelete(l.id) },
      ],
    });

  return (
    <Sheet title="Locations" onClose={onClose}>
      <IonList inset>
        {locations.map((l) => (
          <IonItemSliding key={l.id}>
            <IonItem aria-current={l.id === activeId}>
              <IonLabel>
                <h2>{l.name}</h2>
                <p>
                  {l.grid6}
                  {l.horizonMask.some((m) => m > 0) && ' · horizon mask set'}
                </p>
              </IonLabel>
              {l.id === activeId ? (
                <IonIcon slot="end" icon={checkmarkCircle} color="primary" aria-label="In use" />
              ) : (
                <IonButton slot="end" fill="outline" size="small" onClick={() => onSelect(l.id)} aria-label={`Use ${l.name}`}>
                  Use
                </IonButton>
              )}
              <IonButton slot="end" fill="clear" size="small" onClick={() => setMasking(l)} aria-label={`Horizon mask for ${l.name}`}>
                Horizon
              </IonButton>
              {locations.length > 1 && (
                <IonButton slot="end" fill="clear" color="medium" onClick={() => askDelete(l)} aria-label={`Delete ${l.name}`}>
                  <IonIcon slot="icon-only" icon={trashOutline} aria-hidden />
                </IonButton>
              )}
            </IonItem>
            {locations.length > 1 && (
              <IonItemOptions side="end">
                <IonItemOption color="danger" onClick={() => askDelete(l)}>
                  Delete
                </IonItemOption>
              </IonItemOptions>
            )}
          </IonItemSliding>
        ))}
      </IonList>
      {adding ? (
        <LocationForm onSave={onAdd} submitLabel="Add location" />
      ) : (
        <div className="ion-padding-horizontal">
          <Button onClick={() => setAdding(true)}>Add a location</Button>
        </div>
      )}
      <IonNote className="ion-padding" style={{ display: 'block' }}>
        Add the park, a hilltop, or a grid you plan to rove to. Passes are predicted for whichever is selected.
      </IonNote>
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
