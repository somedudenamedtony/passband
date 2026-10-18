import { useState } from 'react';
import {
  IonInput,
  IonItem,
  IonLabel,
  IonList,
  IonListHeader,
  IonNote,
  IonSelect,
  IonSelectOption,
  IonToggle,
} from '@ionic/react';
import { cueSupport } from '../cue/cue';
import { canRecord } from '../record/recorder';
import type { LoadedCatalog } from '../data/catalog';
import type { Theme } from '../data/theme';
import { formatElementAge } from '../model/elementAge';
import { SunCalibration } from '../compass/SunCalibration';
import type { Location, RadioStepHz, Station } from '../model/types';
import { Segmented, Sheet } from './common';
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
      <IonList inset>
        <IonListHeader>
          <IonLabel>Experience</IonLabel>
        </IonListHeader>
        <IonItem lines="none">
          <Segmented
            label="Experience"
            value={station.experience}
            onChange={(experience) => onChange({ ...station, experience })}
            options={[
              { value: 'new', label: 'New' },
              { value: 'experienced', label: 'I’ve made contacts' },
            ]}
          />
        </IonItem>
        <IonItem lines="none">
          <IonNote>Changes what’s shown by default. Nothing is locked either way.</IonNote>
        </IonItem>
      </IonList>

      <IonList inset>
        <IonListHeader>
          <IonLabel>Station</IonLabel>
        </IonListHeader>
        <IonItem>
          <IonInput
            label="Callsign"
            value={station.callsign}
            placeholder="W7LIT"
            autocapitalize="characters"
            autocorrect={false}
            spellcheck={false}
            className="callsign-input"
            style={{ textAlign: 'right' }}
            onIonInput={(e) => onChange({ ...station, callsign: (e.detail.value ?? '').toUpperCase().trim() })}
          />
        </IonItem>
        <IonItem>
          <IonSelect
            label="Radio tuning step"
            value={station.radioStepHz}
            interface="action-sheet"
            onIonChange={(e) => onChange({ ...station, radioStepHz: e.detail.value as RadioStepHz })}
          >
            {STEPS.map((s) => (
              <IonSelectOption key={s} value={s}>
                {(s / 1000).toString()} kHz
              </IonSelectOption>
            ))}
          </IonSelect>
        </IonItem>
        <IonItem lines="none">
          <IonLabel>Units</IonLabel>
          <div slot="end" style={{ minWidth: 200 }}>
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
        </IonItem>
      </IonList>

      <IonList inset>
        <IonListHeader>
          <IonLabel>Live pass</IonLabel>
        </IonListHeader>
        {cueRows.map((r) => (
          <IonItem key={r.key}>
            <IonToggle
              checked={station.cues[r.key] && support[r.key]}
              disabled={!support[r.key]}
              onIonChange={(e) => onChange({ ...station, cues: { ...station.cues, [r.key]: e.detail.checked } })}
            >
              {r.label}
              {!support[r.key] && (
                <IonNote style={{ display: 'block' }}>{r.missing}</IonNote>
              )}
            </IonToggle>
          </IonItem>
        ))}
        <IonItem>
          <IonToggle
            checked={station.recordPasses && canRecord()}
            disabled={!canRecord()}
            onIonChange={(e) => onChange({ ...station, recordPasses: e.detail.checked })}
          >
            Record passes from AOS
            <IonNote style={{ display: 'block' }}>
              {canRecord() ? 'Microphone or a wired input. Stays on this device.' : 'This browser can’t record audio.'}
            </IonNote>
          </IonToggle>
        </IonItem>
        {location && (
          <IonItem button detail onClick={() => setCalibrating(true)}>
            <IonLabel>
              Calibrate compass against the sun
              <p>
                {station.compassCalibratedAt === null ? 'Not calibrated yet' : `Offset ${station.compassOffsetDeg.toFixed(0)}°`}
              </p>
            </IonLabel>
          </IonItem>
        )}
      </IonList>

      <IonList inset>
        <IonListHeader>
          <IonLabel>Display</IonLabel>
        </IonListHeader>
        <IonItem lines="none">
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
        </IonItem>
        <IonItem lines="none">
          <IonNote>Day is high-contrast for direct sun. Red keeps your night vision.</IonNote>
        </IonItem>
      </IonList>

      <IonNote className="ion-padding" style={{ display: 'block' }}>
        {catalog ? (
          <>
            Satellite data published {formatElementAge(catalog.catalog.generatedAt, now).replace(' old', ' ago')}
            {catalog.fromCache && ' (saved copy — offline)'}. {catalog.catalog.satellites.length} satellites.
          </>
        ) : (
          'No satellite data yet.'
        )}{' '}
        Everything you enter stays on this device.
      </IonNote>

      {calibrating && location && (
        <SunCalibration location={location} station={station} onChange={onChange} onClose={() => setCalibrating(false)} />
      )}
    </Sheet>
  );
}
