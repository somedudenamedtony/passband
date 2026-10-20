// Log a contact after the fact: one made without the live screen open, or remembered later.
// Pick the satellite, tap the pass it was on (or type the time), and the rest fills in.

import { useEffect, useMemo, useState } from 'react';
import { formatMHz } from '../model/freq';
import { formatLocalDay, formatLocalTime } from '../model/format';
import { grid4, isValidGrid, normaliseGrid } from '../model/grid';
import { newId } from '../model/ids';
import { HOUR } from '../model/time';
import { hasWorkingUplink, primaryTransmitter } from '../model/transmitters';
import type { Location, Pass, QsoRecord, Satellite, Station } from '../model/types';
import { predictPasses } from '../predict/client';
import { Button, Field, Panel, Segmented, Select, Sheet } from './common';
import { formatUtcInput, parseUtcInput } from './LogView';
import { modesFor } from './QuickLog';

/** How far back the pass picker looks. */
const LOOKBACK = 48 * HOUR;

export function AddQso({
  sats,
  location,
  station,
  now,
  onSave,
  onClose,
}: {
  sats: readonly Satellite[];
  location: Location;
  station: Station;
  now: number;
  onSave: (q: QsoRecord) => void;
  onClose: () => void;
}) {
  // Satellites you can work: a working uplink, or at least a LoTW name.
  const workable = useMemo(
    () => sats.filter((s) => hasWorkingUplink(s) || s.lotwName).sort((a, b) => a.name.localeCompare(b.name)),
    [sats],
  );
  const [satId, setSatId] = useState<number>(workable.find((s) => s.overlay.difficulty === 'beginner')?.noradId ?? workable[0]?.noradId ?? 0);
  const sat = workable.find((s) => s.noradId === satId);
  const tx = sat ? primaryTransmitter(sat) : null;
  const modes = tx ? modesFor(tx) : ['FM'];
  const [mode, setMode] = useState(modes[0]!);
  useEffect(() => setMode(modes[0]!), [satId]);

  const [passes, setPasses] = useState<Pass[] | null>(null);
  useEffect(() => {
    if (!sat) return;
    let cancelled = false;
    setPasses(null);
    void predictPasses([sat], location, now - LOOKBACK, now).then((p) => {
      if (!cancelled) setPasses(p.filter((x) => x.aos <= now).reverse());
    });
    return () => {
      cancelled = true;
    };
  }, [sat, location, now]);

  const [call, setCall] = useState('');
  const [grid, setGrid] = useState('');
  const [time, setTime] = useState(formatUtcInput(now));
  const [note, setNote] = useState('');
  const t = parseUtcInput(time);
  const gridOk = grid === '' || isValidGrid(grid);
  const ok = sat !== undefined && call.length >= 3 && /\d/.test(call) && t !== null && t <= now && gridOk;

  function save() {
    if (!sat || t === null) return;
    onSave({
      id: newId(),
      call,
      timeOn: t,
      satNoradId: sat.noradId,
      satName: sat.lotwName,
      satDisplayName: sat.name,
      transmitterId: tx?.id ?? '',
      // Nominal frequencies: what the satellite listens and talks on. LoTW reads the band.
      freqHz: tx?.uplinkHz ?? 0,
      freqRxHz: tx?.downlinkHz ?? 0,
      mode,
      gridsquare: grid ? normaliseGrid(grid) : null,
      myGridsquare: grid4(location.grid6),
      stationCallsign: station.callsign,
      locationId: location.id,
      recordingId: null,
      exportedAt: null,
      note: note.trim() || null,
    });
  }

  return (
    <Sheet title="Add a contact" onClose={onClose}>
      <div className="stack">
        <Panel>
          <Select<number>
            label="Satellite"
            value={satId}
            onChange={setSatId}
            options={workable.map((s) => ({ value: s.noradId, label: s.name }))}
          />
          <Field
            label="Their callsign"
            className="callsign-input"
            value={call}
            autoCapitalize="characters"
            autoCorrect="off"
            spellCheck={false}
            onChange={(e) => setCall(e.target.value.toUpperCase().trim())}
          />
          <Field
            label="Their grid (optional)"
            value={grid}
            maxLength={6}
            invalid={!gridOk}
            autoCapitalize="characters"
            onChange={(e) => setGrid(e.target.value.trim())}
          />
        </Panel>

        <div>
          <p className="silk">Which pass?</p>
          {passes === null ? (
            <p className="hint">Working out {sat?.name ?? 'the'} passes from {location.name}…</p>
          ) : passes.length === 0 ? (
            <p className="hint">No {sat?.name} passes over {location.name} in the last two days. Type the time below.</p>
          ) : (
            <div className="chips" role="group" aria-label="Recent passes">
              {passes.slice(0, 6).map((p) => (
                <button
                  key={p.aos}
                  type="button"
                  className="chip"
                  aria-pressed={t !== null && t >= p.aos && t <= p.los}
                  onClick={() => setTime(formatUtcInput(p.tca))}
                >
                  {formatLocalDay(p.aos)} {formatLocalTime(p.aos)} · {Math.round(p.maxElDeg)}°
                </button>
              ))}
            </div>
          )}
        </div>

        <Panel>
          <Field
            label="Time on (UTC)"
            value={time}
            hint="YYYY-MM-DD HH:MM:SS. Tapping a pass sets its highest point; adjust if you know better."
            invalid={t === null || t > now}
            onChange={(e) => setTime(e.target.value)}
          />
          {modes.length > 1 && <Segmented label="Mode" value={mode} onChange={setMode} options={modes.map((m) => ({ value: m, label: m }))} />}
          <Field label="Note (optional)" value={note} onChange={(e) => setNote(e.target.value)} />
        </Panel>

        {tx && (
          <p className="hint mono">
            {sat?.name} · {mode}
            {tx.uplinkHz !== null && ` · ↑ ${formatMHz(tx.uplinkHz)}`}
            {tx.downlinkHz !== null && ` ↓ ${formatMHz(tx.downlinkHz)}`} · from {grid4(location.grid6)}
          </p>
        )}
        <Button kind="primary" size="large" disabled={!ok} onClick={save}>
          Save contact
        </Button>
      </div>
    </Sheet>
  );
}
