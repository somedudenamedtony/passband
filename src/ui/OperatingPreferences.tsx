import type { Station } from '../model/types';
import { Segmented, Select } from './common';

export function OperatingPreferences({ station, onChange }: { station: Station; onChange: (s: Station) => void }) {
  return (
    <div className="stack">
      <Segmented label="Operating goal" value={station.goal} onChange={(goal) => onChange({ ...station, goal })}
        options={[{ value: 'listen', label: 'Listen' }, { value: 'contacts', label: 'Make contacts' }, { value: 'explore', label: 'Explore' }]} />
      <Select label="Your radio" value={station.equipment} onChange={(equipment) => onChange({ ...station, equipment })}
        options={[{ value: 'unknown', label: 'Choose later / other' }, { value: 'fm', label: 'Dual-band FM radio' }, { value: 'ssb', label: 'SSB / CW capable station' }, { value: 'sdr', label: 'SDR receiver' }]} />
      <p className="hint">Recommendations follow your goal and radio. Browse the full catalog any time.</p>
      {station.equipment === 'sdr' && station.goal === 'contacts' && <p className="hint">An SDR receiver can listen. Choose Listen, or select a station that can transmit to find two-way targets.</p>}
    </div>
  );
}
