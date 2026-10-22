// SPEC-v2 §6.7: one Station screen. Goal, radio and guidance are v2's three answers (D19); quality
// thresholds are v2's (D26). Then callsign, units, hours, live cues, compass and display.

import { useEffect, useState } from 'react';
import { Link } from '../app/Link';
import { applyTheme, loadTheme, saveTheme, type Theme } from '../data/theme';
import { fromV1Station, toV1Station, type StationV2 } from '../model/stationV2';
import { store, useActiveLocation, useAppState } from '../store/store';
import { Field, Panel, SectionTitle, Segmented, Select } from '../ui/common';
import { SettingsBody } from '../ui/SettingsSheet';

export function StationScreen() {
  const station = useAppState((s) => s.station);
  const catalog = useAppState((s) => s.catalog);
  const location = useActiveLocation();
  const [theme, setTheme] = useState<Theme>('auto');
  useEffect(() => {
    void loadTheme().then(setTheme);
  }, []);
  if (!station) return null;
  const update = (patch: Partial<StationV2>) => void store.updateStation(patch);
  const t = station.qualityThresholdsDeg;

  return (
    <div className="stack">
      <h1 className="screen-title">Station</h1>

      <SectionTitle>You</SectionTitle>
      <Panel className="stack">
        <YouFields station={station} update={update} />
        <p className="hint">Walk me through it shows tips, the checklist and the first-contact guide. Everything stays reachable either way.</p>
        <Link to={{ name: 'help' }} className="key key-secondary key-block">Help and your first contact</Link>
      </Panel>

      <SectionTitle>Pass quality</SectionTitle>
      <Panel className="stack">
        <p className="hint">How high a pass has to climb to read as fair or great.</p>
        <div className="field-pair">
          <Field
            label="Fair from (°)"
            type="number"
            inputMode="numeric"
            min={0}
            max={89}
            value={t.fair}
            onChange={(e) => {
              const fair = Math.max(0, Math.min(89, Number(e.target.value) || 0));
              update({ qualityThresholdsDeg: { fair, great: Math.max(fair + 1, t.great) } });
            }}
          />
          <Field
            label="Great from (°)"
            type="number"
            inputMode="numeric"
            min={1}
            max={90}
            value={t.great}
            onChange={(e) => {
              const great = Math.max(1, Math.min(90, Number(e.target.value) || 1));
              update({ qualityThresholdsDeg: { fair: Math.min(t.fair, great - 1), great } });
            }}
          />
        </div>
      </Panel>

      <SettingsBody
        station={toV1Station(station)}
        onChange={(v1) => void store.updateStation(fromV1Station(v1, station))}
        theme={theme}
        onTheme={(next) => {
          setTheme(next);
          applyTheme(next);
          void saveTheme(next);
        }}
        catalog={catalog}
        location={location}
      />
    </div>
  );
}

/** SPEC-v2 D19's three answers. On Station, and on first run. */
export function YouFields({ station, update }: { station: StationV2; update: (patch: Partial<StationV2>) => void }) {
  return (
    <>
          <p className="seg-question">What do you want to do?</p>
          <Segmented
            label="What you want to do"
            value={station.goal}
            onChange={(goal) => update({ goal })}
            options={[
              { value: 'listen', label: 'Listen' },
              { value: 'contacts', label: 'Make contacts' },
              { value: 'both', label: 'Both' },
            ]}
          />
          <Select
            label="Your radio"
            value={station.radio}
            onChange={(radio) => update({ radio })}
            options={[
              { value: 'fm', label: 'FM handheld' },
              { value: 'ssb', label: 'SSB / CW' },
              { value: 'sdr', label: 'SDR / receiver' },
              { value: 'unknown', label: 'Not sure' },
            ]}
          />
          <p className="seg-question">How much help do you want?</p>
          <Segmented
            label="Guidance"
            value={station.guidance}
            onChange={(guidance) => update({ guidance })}
            options={[
              { value: 'guided', label: 'Walk me through it' },
              { value: 'numbers', label: 'Just the numbers' },
            ]}
          />
    </>
  );
}
