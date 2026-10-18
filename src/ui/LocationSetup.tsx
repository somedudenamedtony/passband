import { useState, type FormEvent } from 'react';
import { IonInput, IonItem, IonList, IonNote, IonText } from '@ionic/react';
import { locationFromCoords, locationFromGrid } from '../data/locations';
import { isValidGrid } from '../model/grid';
import type { Location } from '../model/types';
import { Button } from './common';

/** D8: a manually entered grid or the Geolocation API. Nothing is sent anywhere. */
export function LocationForm({ onSave, submitLabel = 'Save' }: { onSave: (l: Location) => void; submitLabel?: string }) {
  const [name, setName] = useState('');
  const [grid, setGrid] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [locating, setLocating] = useState(false);
  const canLocate = typeof navigator !== 'undefined' && 'geolocation' in navigator;

  function submit(e?: FormEvent) {
    e?.preventDefault();
    if (!isValidGrid(grid)) {
      setError('Enter a 4- or 6-character grid square, like CN87 or CN87uo.');
      return;
    }
    setError(null);
    onSave(locationFromGrid(name, grid));
  }

  function locate() {
    setLocating(true);
    setError(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocating(false);
        const { latitude, longitude, altitude } = pos.coords;
        onSave(locationFromCoords(name || 'Here', latitude, longitude, altitude ?? 0));
      },
      (err) => {
        setLocating(false);
        setError(
          err.code === err.PERMISSION_DENIED
            ? 'Location permission was refused. Enter your grid square instead.'
            : 'Couldn’t get a location fix. Enter your grid square instead.',
        );
      },
      { enableHighAccuracy: true, timeout: 20_000 },
    );
  }

  return (
    <form onSubmit={submit}>
      <IonList inset>
        <IonItem>
          <IonInput label="Name (optional)" labelPlacement="stacked" value={name} placeholder="Home" onIonInput={(e) => setName(e.detail.value ?? '')} />
        </IonItem>
        <IonItem>
          <IonInput
            label="Grid square"
            labelPlacement="stacked"
            value={grid}
            placeholder="CN87uo"
            autocapitalize="characters"
            autocorrect={false}
            spellcheck={false}
            maxlength={6}
            helperText="Your Maidenhead locator. QRZ or a grid map will tell you yours."
            onIonInput={(e) => setGrid(e.detail.value ?? '')}
            onKeyDown={(e) => {
              if (e.key === 'Enter') submit();
            }}
          />
        </IonItem>
      </IonList>
      <div className="ion-padding-horizontal stack">
        <Button kind="primary" type="submit">
          {submitLabel}
        </Button>
        {canLocate && (
          <Button onClick={locate} disabled={locating}>
            {locating ? 'Finding you…' : 'Use my current location'}
          </Button>
        )}
        {error && (
          <IonText color="danger">
            <p role="alert">{error}</p>
          </IonText>
        )}
        <IonNote>Your location stays on this device.</IonNote>
      </div>
    </form>
  );
}

export function LocationSetup({ onSave }: { onSave: (l: Location) => void }) {
  return (
    <section>
      <h1 style={{ fontWeight: 800 }}>Where are you operating from?</h1>
      <p className="muted">Passband needs a location to work out which satellites pass over you, and when.</p>
      <LocationForm onSave={onSave} submitLabel="Show my passes" />
    </section>
  );
}
