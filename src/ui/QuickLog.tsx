// §5.2 quick log: big keys for gloves, time filled in, one tap to save, edit later in the Log tab.

import { useState } from 'react';
import { formatMHz } from '../model/freq';
import { formatUtc } from '../model/format';
import { grid4, isValidGrid, normaliseGrid } from '../model/grid';
import { newId } from '../model/ids';
import type { RigSetting } from '../rig/rig';
import type { Location, QsoRecord, Satellite, Station, Transmitter } from '../model/types';
import { Banner, Button, Segmented, Sheet, Toggle } from './common';
import { Icon } from './icons';

// The digit row is built rather than written out, so it can't be mistaken for a frequency (§10).
const DIGITS = Array.from({ length: 10 }, (_, i) => String((i + 1) % 10)).join('');
const ROWS = [DIGITS, 'QWERTYUIOP', 'ASDFGHJKL/', 'ZXCVBNM'];

/** Modes a user can pick for this transmitter; the first is the default. */
export function modesFor(tx: Transmitter): string[] {
  if (tx.kind === 'linear_transponder') return ['USB', 'LSB', 'CW'];
  if (tx.kind === 'digipeater' || tx.mode === 'APRS') return ['PKT'];
  if (tx.mode === 'SSTV') return ['SSTV'];
  return ['FM'];
}

export function QuickLog({
  sat,
  tx,
  setting,
  location,
  station,
  timeOn,
  onSave,
  onClose,
}: {
  sat: Satellite;
  tx: Transmitter;
  setting: RigSetting | null;
  location: Location;
  station: Station;
  timeOn: number;
  onSave: (q: QsoRecord) => void | Promise<void>;
  onClose: () => void;
}) {
  const [call, setCall] = useState('');
  const [grid, setGrid] = useState('');
  const [target, setTarget] = useState<'call' | 'grid'>('call');
  const [fieldKeypad, setFieldKeypad] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(false);
  const modes = modesFor(tx);
  const [mode, setMode] = useState(modes[0]!);

  const value = target === 'call' ? call : grid;
  const set = target === 'call' ? setCall : setGrid;
  const max = target === 'call' ? 12 : 6;
  const gridOk = grid === '' || isValidGrid(grid);
  const canSave = call.length >= 3 && /\d/.test(call) && gridOk;

  async function save() {
    if (!canSave || saving) return;
    setSaving(true);
    setSaveError(false);
    try { await onSave({
      id: newId(),
      call,
      timeOn,
      satNoradId: sat.noradId,
      satName: sat.lotwName,
      satDisplayName: sat.name,
      transmitterId: tx.id,
      freqHz: setting?.uplinkHz ?? tx.uplinkHz ?? 0,
      freqRxHz: setting?.downlinkHz ?? tx.downlinkHz ?? 0,
      mode,
      gridsquare: grid ? normaliseGrid(grid) : null,
      myGridsquare: grid4(location.grid6),
      stationCallsign: station.callsign,
      locationId: location.id,
      recordingId: null,
      exportedAt: null,
      note: null,
    }); } catch { setSaveError(true); }
    finally { setSaving(false); }
  }

  return (
    <Sheet title={`Log a contact on ${sat.name}`} onClose={onClose}>
      <form className="stack" onSubmit={(e) => { e.preventDefault(); void save(); }}>
        <div className="lcd quicklog-fields">
          <label className={`call-field${target === 'call' ? ' is-active' : ''}`}>
            <small>Their callsign</small>
            <input autoFocus aria-label="Their callsign" className="readout readout-l" value={call} placeholder="----"
              autoCapitalize="characters" autoCorrect="off" spellCheck={false} maxLength={12} inputMode={fieldKeypad ? 'none' : 'text'}
              onFocus={() => setTarget('call')} onChange={(e) => setCall(e.target.value.toUpperCase().replace(/[^A-Z0-9/]/g, ''))} />
          </label>
          <label className={`call-field${target === 'grid' ? ' is-active' : ''}`}>
            <small>Grid (optional)</small>
            <input aria-label="Their grid" className="readout readout-m" value={grid} placeholder="----"
              aria-invalid={!gridOk} autoCapitalize="characters" autoCorrect="off" spellCheck={false} maxLength={6} inputMode={fieldKeypad ? 'none' : 'text'}
              onFocus={() => setTarget('grid')} onChange={(e) => setGrid(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))} />
          </label>
        </div>

        <Toggle checked={fieldKeypad} onChange={setFieldKeypad} hint="Typing and paste work with either option.">Use field keypad</Toggle>
        {fieldKeypad && <div className="keypad" aria-label="Keypad">
          {ROWS.map((row) => (
            <div key={row} className="keypad-row">
              {row.split('').map((k) => (
                <button key={k} type="button" onClick={() => value.length < max && set(value + k)}>
                  {k}
                </button>
              ))}
              {row === 'ZXCVBNM' && (
                <button type="button" className="wide" onClick={() => set(value.slice(0, -1))} aria-label="Delete">
                  <Icon name="backspace" />
                </button>
              )}
            </div>
          ))}
        </div>}
        {!gridOk && <p role="alert" className="danger-text">Enter a 4- or 6-character grid, or leave it blank.</p>}

        {modes.length > 1 && <Segmented label="Mode" value={mode} onChange={setMode} options={modes.map((m) => ({ value: m, label: m }))} />}

        <p className="hint mono">
          {formatUtc(timeOn, true)} · {mode}
          {setting?.uplinkHz != null && ` · ↑ ${formatMHz(setting.uplinkHz)}`}
          {setting?.downlinkHz != null && ` · ↓ ${formatMHz(setting.downlinkHz)}`} · from {grid4(location.grid6)}
        </p>
        {!sat.lotwName && (
          <Banner tone="warn">
            {sat.overlay.curated ? `${sat.name} isn’t on LoTW’s satellite list.` : `LoTW name for ${sat.name} is unknown.`} The
            contact is saved, but LoTW won’t accept it as a satellite QSO.
          </Banner>
        )}
        {!station.callsign && <Banner tone="warn">Set your own callsign in Settings before exporting.</Banner>}

        {saveError && <Banner tone="danger">Couldn’t save this contact. Your entry is still here; try again.</Banner>}
        <Button kind="primary" type="submit" size="large" disabled={!canSave || saving}>
          {saving ? 'Saving…' : `Save ${call || 'contact'}`}
        </Button>
      </form>
    </Sheet>
  );
}
