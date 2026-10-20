import { useState } from 'react';
import { cueSupport } from '../cue/cue';
import { canRecord } from '../record/recorder';
import type { LoadedCatalog } from '../data/catalog';
import type { Theme } from '../data/theme';
import { formatElementAge } from '../model/elementAge';
import { SunCalibration } from '../compass/SunCalibration';
import type { Location, RadioStepHz, Station } from '../model/types';
import { Button, Field, Panel, SectionTitle, Segmented, Select, Sheet, Toggle } from './common';
import { useNow } from './clock';

const STEPS: RadioStepHz[] = [2500, 5000, 6250];

export function SettingsSheet({
  station,
  onChange,
  theme,
  onTheme,
  catalog,
  location,
  onClose,
}: {
  station: Station;
  onChange: (s: Station) => void;
  theme: Theme;
  onTheme: (t: Theme) => void;
  catalog: LoadedCatalog | null;
  location: Location | null;
  onClose: () => void;
}) {
  const [calibrating, setCalibrating] = useState(false);
  const now = useNow(60_000);
  const support = cueSupport();
  const cueRows: Array<{ key: keyof Station['cues']; label: string; missing: string }> = [
    { key: 'speech', label: 'Spoken cues', missing: 'This browser can’t speak.' },
    { key: 'tones', label: 'Tones', missing: 'This browser can’t play tones.' },
    { key: 'vibration', label: 'Vibration', missing: 'This device can’t vibrate from a web page.' },
  ];

  return (
    <Sheet title="Settings" onClose={onClose}>
      <SectionTitle>Experience</SectionTitle>
      <Panel className="stack">
        <Segmented
          label="Experience"
          value={station.experience}
          onChange={(experience) => onChange({ ...station, experience })}
          options={[
            { value: 'new', label: 'New' },
            { value: 'experienced', label: 'I’ve made contacts' },
          ]}
        />
        <p className="hint">Changes what’s shown by default. Nothing is locked either way.</p>
      </Panel>

      <SectionTitle>Station</SectionTitle>
      <Panel className="stack">
        <Field
          label="Callsign"
          className="callsign-input"
          value={station.callsign}
          placeholder="W7LIT"
          autoCapitalize="characters"
          autoCorrect="off"
          spellCheck={false}
          onChange={(e) => onChange({ ...station, callsign: e.target.value.toUpperCase().trim() })}
        />
        <Select
          label="Radio tuning step"
          value={station.radioStepHz}
          onChange={(radioStepHz) => onChange({ ...station, radioStepHz })}
          options={STEPS.map((s) => ({ value: s, label: `${(s / 1000).toString()} kHz` }))}
        />
        <div className="field-inline field">
          <span className="silk" style={{ flex: 1 }}>
            Units
          </span>
          <div style={{ minWidth: 180 }}>
            <Segmented
              label="Units"
              value={station.units}
              onChange={(units) => onChange({ ...station, units })}
              options={[
                { value: 'imperial', label: 'Miles' },
                { value: 'metric', label: 'km' },
              ]}
            />
          </div>
        </div>
      </Panel>

      <SectionTitle>Live pass</SectionTitle>
      <Panel>
        {cueRows.map((r) => (
          <Toggle
            key={r.key}
            checked={station.cues[r.key] && support[r.key]}
            disabled={!support[r.key]}
            onChange={(v) => onChange({ ...station, cues: { ...station.cues, [r.key]: v } })}
            hint={!support[r.key] ? r.missing : undefined}
          >
            {r.label}
          </Toggle>
        ))}
        <Select<Station['speakInPass']>
          label="Speak during the pass"
          value={station.speakInPass}
          onChange={(speakInPass) => onChange({ ...station, speakInPass })}
          options={[
            { value: 'key', label: 'Rise, peak, set' },
            { value: 'all', label: 'Everything' },
            { value: 'none', label: 'Nothing' },
          ]}
        />
        <p className="hint" style={{ marginBottom: 8 }}>
          {station.speakInPass === 'all'
            ? 'Retunes are read out. A voice cue that plays while you transmit goes out over the air.'
            : station.speakInPass === 'key'
              ? 'Retunes are a short double beep, so the phone doesn’t talk over the satellite. The screen shows the new frequency.'
              : 'Only beeps once the satellite is up; rise and set are still announced.'}
        </p>
        <Toggle
          checked={station.recordPasses && canRecord()}
          disabled={!canRecord()}
          onChange={(v) => onChange({ ...station, recordPasses: v })}
          hint={canRecord() ? 'Microphone or a wired input. Stays on this device.' : 'This browser can’t record audio.'}
        >
          Record passes from AOS
        </Toggle>
        {location && (
          <div style={{ marginTop: 8 }}>
            <Button onClick={() => setCalibrating(true)}>Calibrate compass against the sun</Button>
            <p className="hint" style={{ marginTop: 6 }}>
              {station.compassCalibratedAt === null ? 'Not calibrated yet' : `Offset ${station.compassOffsetDeg.toFixed(0)}°`}
            </p>
          </div>
        )}
      </Panel>

      <SectionTitle>Display</SectionTitle>
      <Panel className="stack">
        <Segmented
          label="Display"
          value={theme}
          onChange={onTheme}
          options={[
            { value: 'auto', label: 'Auto' },
            { value: 'light', label: 'Day' },
            { value: 'dark', label: 'Dark' },
            { value: 'night', label: 'Red' },
          ]}
        />
        <p className="hint">Day is high-contrast for direct sun. Red keeps your night vision.</p>
      </Panel>

      <p className="hint" style={{ marginTop: 18 }}>
        {catalog ? (
          <>
            Satellite data published {formatElementAge(catalog.catalog.generatedAt, now).replace(' old', ' ago')}
            {catalog.fromCache && ' (saved copy — offline)'}. {catalog.catalog.satellites.length} satellites.
          </>
        ) : (
          'No satellite data yet.'
        )}{' '}
        Everything you enter stays on this device.
      </p>

      {calibrating && location && (
        <SunCalibration location={location} station={station} onChange={onChange} onClose={() => setCalibrating(false)} />
      )}
    </Sheet>
  );
}
