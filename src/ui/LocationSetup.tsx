import { useState, type FormEvent } from 'react';
import { locationFromCoords, locationFromGrid } from '../data/locations';
import { isValidGrid } from '../model/grid';
import type { Location } from '../model/types';
import { Button, Field, Panel } from './common';
import { Icon } from './icons';

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
    <form onSubmit={submit} className="stack">
      {canLocate && (
        <>
          <Button kind="primary" size="large" onClick={locate} disabled={locating}>
            <Icon name="location" />
            {locating ? 'Finding you…' : 'Use my current location'}
          </Button>
          <p className="or-rule" aria-hidden>
            <span>or enter your grid square</span>
          </p>
        </>
      )}
      <Panel>
        <Field label="Name (optional)" value={name} placeholder="Home" onChange={(e) => setName(e.target.value)} />
        <Field
          label="Grid square"
          value={grid}
          placeholder="CN87uo"
          autoCapitalize="characters"
          autoCorrect="off"
          spellCheck={false}
          maxLength={6}
          hint="Your Maidenhead locator, like CN87 or CN87uo. QRZ or a grid map will tell you yours."
          onChange={(e) => setGrid(e.target.value)}
        />
      </Panel>
      <Button kind={canLocate ? 'secondary' : 'primary'} type="submit" size="large">
        {submitLabel}
      </Button>
      {error && (
        <p role="alert" className="danger-text">
          {error}
        </p>
      )}
      <p className="hint">Your location stays on this device.</p>
    </form>
  );
}
