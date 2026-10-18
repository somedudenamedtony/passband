import { cueSupport } from '../cue/cue';
import type { LoadedCatalog } from '../data/catalog';
import type { Theme } from '../data/theme';
import { formatElementAge } from '../model/elementAge';
import type { RadioStepHz, Station } from '../model/types';
import { Field, Segmented, Sheet, inputClass } from './common';
import { useNow } from './clock';

export function SettingsSheet({
  station,
  onChange,
  theme,
  onTheme,
  catalog,
  onClose,
}: {
  station: Station;
  onChange: (s: Station) => void;
  theme: Theme;
  onTheme: (t: Theme) => void;
  catalog: LoadedCatalog | null;
  onClose: () => void;
}) {
  const now = useNow(60_000);
  return (
    <Sheet title="Settings" onClose={onClose}>
      <div className="space-y-5">
        <Field label="Experience" hint="Changes what’s shown by default. Nothing is locked either way.">
          <Segmented
            label="Experience"
            value={station.experience}
            onChange={(experience) => onChange({ ...station, experience })}
            options={[
              { value: 'new', label: 'New to satellites' },
              { value: 'experienced', label: 'I’ve made contacts' },
            ]}
          />
        </Field>
        <Field label="Callsign">
          <input
            className={`${inputClass} uppercase`}
            value={station.callsign}
            onChange={(e) => onChange({ ...station, callsign: e.target.value.toUpperCase().trim() })}
            placeholder="W7LIT"
            autoCapitalize="characters"
            autoCorrect="off"
            spellCheck={false}
          />
        </Field>
        <Field label="Units">
          <Segmented
            label="Units"
            value={station.units}
            onChange={(units) => onChange({ ...station, units })}
            options={[
              { value: 'imperial', label: 'Miles' },
              { value: 'metric', label: 'Kilometres' },
            ]}
          />
        </Field>
        <Field label="Radio tuning step" hint="FM frequencies are rounded to what your radio can tune.">
          <Segmented<RadioStepHz>
            label="Radio tuning step"
            value={station.radioStepHz}
            onChange={(radioStepHz) => onChange({ ...station, radioStepHz })}
            options={[
              { value: 2500, label: '2.5 kHz' },
              { value: 5000, label: '5 kHz' },
              { value: 6250, label: '6.25 kHz' },
            ]}
          />
        </Field>
        <CueSettings station={station} onChange={onChange} />
        <Field label="Display">
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
        </Field>
        <div className="rounded-xl border border-line p-3 text-sm text-muted">
          {catalog ? (
            <>
              Satellite data published {formatElementAge(catalog.catalog.generatedAt, now).replace(' old', ' ago')}
              {catalog.fromCache && ' (saved copy — offline)'}. {catalog.catalog.satellites.length} satellites.
            </>
          ) : (
            'No satellite data yet.'
          )}
          <br />
          Everything you enter stays on this device.
        </div>
      </div>
    </Sheet>
  );
}

function CueSettings({ station, onChange }: { station: Station; onChange: (s: Station) => void }) {
  const support = cueSupport();
  const rows: Array<{ key: keyof Station['cues']; label: string; missing: string }> = [
    { key: 'speech', label: 'Spoken cues', missing: 'This browser can’t speak.' },
    { key: 'tones', label: 'Tones', missing: 'This browser can’t play tones.' },
    { key: 'vibration', label: 'Vibration', missing: 'This device can’t vibrate from a web page.' },
  ];
  return (
    <fieldset>
      <legend className="mb-1 text-sm font-semibold text-muted">Live-pass cues</legend>
      {rows.map((r) => (
        <label key={r.key} className="flex min-h-12 items-center gap-3">
          <input
            type="checkbox"
            className="size-6"
            disabled={!support[r.key]}
            checked={station.cues[r.key] && support[r.key]}
            onChange={(e) => onChange({ ...station, cues: { ...station.cues, [r.key]: e.target.checked } })}
          />
          <span>
            {r.label}
            {!support[r.key] && <span className="block text-sm text-muted">{r.missing}</span>}
          </span>
        </label>
      ))}
    </fieldset>
  );
}
