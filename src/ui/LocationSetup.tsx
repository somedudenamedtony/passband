import { useState, type FormEvent } from 'react';
import { locationFromCoords, locationFromGrid } from '../data/locations';
import { isValidGrid } from '../model/grid';
import type { Location } from '../model/types';
import { Button, Field, inputClass } from './common';

/** D8: a manually entered grid or the Geolocation API. Nothing is sent anywhere. */
export function LocationForm({ onSave, submitLabel = 'Save' }: { onSave: (l: Location) => void; submitLabel?: string }) {
  const [name, setName] = useState('');
  const [grid, setGrid] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [locating, setLocating] = useState(false);
  const canLocate = typeof navigator !== 'undefined' && 'geolocation' in navigator;

  function submit(e: FormEvent) {
    e.preventDefault();
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
    <form onSubmit={submit} className="space-y-4">
      <Field label="Name (optional)">
        <input className={inputClass} value={name} onChange={(e) => setName(e.target.value)} placeholder="Home" />
      </Field>
      <Field label="Grid square" hint="Your Maidenhead locator. QRZ or a grid map will tell you yours.">
        <input
          className={`${inputClass} uppercase`}
          value={grid}
          onChange={(e) => setGrid(e.target.value)}
          placeholder="CN87uo"
          autoCapitalize="characters"
          autoCorrect="off"
          spellCheck={false}
          maxLength={6}
          aria-invalid={error !== null}
        />
      </Field>
      {error && (
        <p role="alert" className="text-sm font-semibold text-danger-fg">
          {error}
        </p>
      )}
      <div className="flex flex-col gap-2">
        <Button type="submit" kind="primary">
          {submitLabel}
        </Button>
        {canLocate && (
          <Button onClick={locate} disabled={locating}>
            {locating ? 'Finding you…' : 'Use my current location'}
          </Button>
        )}
      </div>
      <p className="text-sm text-muted">Your location stays on this device.</p>
    </form>
  );
}

export function LocationSetup({ onSave }: { onSave: (l: Location) => void }) {
  return (
    <section className="space-y-4 py-4">
      <h1 className="text-2xl font-bold">Where are you operating from?</h1>
      <p className="text-muted">Passband needs a location to work out which satellites pass over you, and when.</p>
      <LocationForm onSave={onSave} submitLabel="Show my passes" />
    </section>
  );
}
