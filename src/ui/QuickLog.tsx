// §5.2 quick log: big keys for gloves, time filled in, one tap to save, edit later in the Log tab.

import { useState } from 'react';
import { formatMHz } from '../model/freq';
import { formatUtc } from '../model/format';
import { grid4, isValidGrid, normaliseGrid } from '../model/grid';
import { newId } from '../model/ids';
import type { RigSetting } from '../rig/rig';
import type { Location, QsoRecord, Satellite, Station, Transmitter } from '../model/types';
import { Button, Segmented, Sheet } from './common';

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
  onSave: (q: QsoRecord) => void;
  onClose: () => void;
}) {
  const [call, setCall] = useState('');
  const [grid, setGrid] = useState('');
  const [target, setTarget] = useState<'call' | 'grid'>('call');
  const modes = modesFor(tx);
  const [mode, setMode] = useState(modes[0]!);

  const value = target === 'call' ? call : grid;
  const set = target === 'call' ? setCall : setGrid;
  const max = target === 'call' ? 12 : 6;
  const gridOk = grid === '' || isValidGrid(grid);
  const canSave = call.length >= 3 && /\d/.test(call) && gridOk;

  function save() {
    onSave({
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
    });
  }

  return (
    <Sheet title={`Log a contact on ${sat.name}`} onClose={onClose}>
      <div className="space-y-3">
        <div className="grid grid-cols-[2fr_1fr] gap-2">
          <button
            type="button"
            onClick={() => setTarget('call')}
            aria-pressed={target === 'call'}
            className={`min-h-16 rounded-xl border-2 px-3 text-left ${target === 'call' ? 'border-accent' : 'border-line'}`}
          >
            <span className="block text-xs font-semibold text-muted">Their callsign</span>
            <span className="tabular text-3xl font-black tracking-wide" aria-label="Their callsign">
              {call || <span className="text-muted">—</span>}
            </span>
          </button>
          <button
            type="button"
            onClick={() => setTarget('grid')}
            aria-pressed={target === 'grid'}
            className={`min-h-16 rounded-xl border-2 px-3 text-left ${target === 'grid' ? 'border-accent' : 'border-line'}`}
          >
            <span className="block text-xs font-semibold text-muted">Grid (optional)</span>
            <span className={`tabular text-2xl font-black ${gridOk ? '' : 'text-danger-fg'}`} aria-label="Their grid">
              {grid || <span className="text-muted">—</span>}
            </span>
          </button>
        </div>

        <div className="space-y-1" aria-label="Keypad">
          {ROWS.map((row) => (
            <div key={row} className="flex gap-1">
              {row.split('').map((k) => (
                <button
                  key={k}
                  type="button"
                  onClick={() => value.length < max && set(value + k)}
                  className="min-h-12 flex-1 rounded-lg border border-line bg-surface text-lg font-bold"
                >
                  {k}
                </button>
              ))}
              {row === 'ZXCVBNM' && (
                <button
                  type="button"
                  onClick={() => set(value.slice(0, -1))}
                  className="min-h-12 flex-[2] rounded-lg border border-line bg-surface text-lg font-bold"
                  aria-label="Delete"
                >
                  ⌫
                </button>
              )}
            </div>
          ))}
        </div>

        {modes.length > 1 && <Segmented label="Mode" value={mode} onChange={setMode} options={modes.map((m) => ({ value: m, label: m }))} />}

        <p className="tabular text-sm text-muted">
          {formatUtc(timeOn, true)} · {mode}
          {setting?.uplinkHz != null && ` · ↑ ${formatMHz(setting.uplinkHz)}`}
          {setting?.downlinkHz != null && ` · ↓ ${formatMHz(setting.downlinkHz)}`} · from {grid4(location.grid6)}
        </p>
        {!sat.lotwName && (
          <p className="text-sm font-semibold">
            {sat.overlay.curated ? `${sat.name} isn’t on LoTW’s satellite list.` : `LoTW name for ${sat.name} is unknown.`} The
            contact is saved, but LoTW won’t accept it as a satellite QSO.
          </p>
        )}
        {!station.callsign && <p className="text-sm font-semibold">Set your own callsign in Settings before exporting.</p>}

        <Button kind="primary" className="w-full text-lg" disabled={!canSave} onClick={save}>
          Save {call || 'contact'}
        </Button>
      </div>
    </Sheet>
  );
}
