import { useState, type FormEvent } from 'react';
import { locationFromCoords, locationFromGrid } from '../data/locations';
import { isValidGrid } from '../model/grid';
import type { Location, Station } from '../model/types';
import { Button, Field, Panel, Segmented } from './common';
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

/**
 * First run: the two things that change what Passband shows (experience, D19, and callsign), then
 * where you are. Everything has a default, so only the location is needed to go on.
 */
export function LocationSetup({
  onSave,
  station,
  onStation,
}: {
  onSave: (l: Location) => void;
  station: Station;
  onStation: (s: Station) => void;
}) {
  return (
    <section className="stack">
      <h1 className="setup-title">Welcome to Passband</h1>
      <p className="muted">Three quick questions, and you’ll see which satellites pass over you, and when.</p>

      <h2 className="setup-step">1. Have you made a satellite contact before?</h2>
      <Segmented
        label="Experience"
        value={station.experience}
        onChange={(experience) => onStation({ ...station, experience })}
        options={[
          { value: 'new', label: 'Not yet' },
          { value: 'experienced', label: 'I’ve made contacts' },
        ]}
      />
      <p className="hint">
        {station.experience === 'new'
          ? 'You’ll start with the easy FM satellites and a first-contact guide.'
          : 'You’ll see every satellite with a working uplink, and denser pass details.'}{' '}
        Change it any time in Settings.
      </p>

      <h2 className="setup-step">2. Your callsign (optional)</h2>
      <Panel>
        <Field
          label="Callsign"
          className="callsign-input"
          value={station.callsign}
          placeholder="W7LIT"
          autoCapitalize="characters"
          autoCorrect="off"
          spellCheck={false}
          hint="Goes in your log exports. No licence yet? Leave it blank."
          onChange={(e) => onStation({ ...station, callsign: e.target.value.toUpperCase().trim() })}
        />
      </Panel>

      <h2 className="setup-step">3. Where are you operating from?</h2>
      <LocationForm onSave={onSave} submitLabel="Show my passes" />
    </section>
  );
}
