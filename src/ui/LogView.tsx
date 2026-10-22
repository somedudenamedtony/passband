// §5.4: the log. Newest first, filter by satellite, ADIF export (D11, D12), grids toward VUCC.

import { useMemo, useRef, useState } from 'react';
import { importAdif, type ImportResult } from '../model/adifImport';
import { AddQso } from './AddQso';
import { lotwProblems, toAdif } from '../model/adif';
import { formatMHz } from '../model/freq';
import { formatLocalDay, formatLocalTime, formatUtc } from '../model/format';
import { grid4, isValidGrid, normaliseGrid } from '../model/grid';
import type { LoadedCatalog } from '../data/catalog';
import type { Location, Pass, QsoRecord, Recording, Station } from '../model/types';
import { Recordings } from './Recordings';
import { shareOrDownload } from './share';

type Catalog = LoadedCatalog;
import { Banner, Button, Field, Panel, Select, Sheet, useConfirm } from './common';
import { Icon } from './icons';
import { useClock } from './clock';

/** D11: nudge for an export after this many unexported contacts. */
export const EXPORT_NUDGE = 25;
const VUCC = 100;

export function unexportedCount(qsos: readonly QsoRecord[]): number {
  return qsos.filter((q) => q.exportedAt === null).length;
}

export function gridsWorked(qsos: readonly QsoRecord[]): Set<string> {
  return new Set(qsos.filter((q) => q.gridsquare && isValidGrid(q.gridsquare)).map((q) => grid4(q.gridsquare!)));
}

export function LogView({
  qsos,
  station,
  onSave,
  onDelete,
  onExported,
  recordings,
  onDeleteRecording,
  catalog,
  locations,
  location,
  onImport,
  contactPass,
  onContactPassUsed,
}: {
  qsos: QsoRecord[];
  station: Station;
  onSave: (q: QsoRecord) => void;
  onDelete: (id: string) => void;
  onExported: (ids: string[], at: number) => void;
  recordings: Recording[];
  onDeleteRecording: (id: string) => void;
  catalog: Catalog;
  locations: Location[];
  /** The active location: where a contact added by hand was made from. */
  location: Location;
  /** Save many contacts at once (ADIF import). */
  onImport: (qsos: QsoRecord[]) => Promise<void>;
  contactPass: Pass | null;
  onContactPassUsed: () => void;
}) {
  const clock = useClock();
  // By display name: imported contacts on satellites the catalog doesn't carry have no NORAD id.
  const [filter, setFilter] = useState<string>('all');
  const [editing, setEditing] = useState<QsoRecord | null>(null);
  const [adding, setAdding] = useState(contactPass !== null);
  const [imported, setImported] = useState<ImportResult | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  async function importFile(file: File) {
    setImportError(null);
    setImported(null);
    try {
      const r = importAdif(await file.text(), catalog.catalog.satellites, qsos, station, location, clock.now());
      if (r.qsos.length) await onImport(r.qsos);
      setImported(r);
    } catch (e) {
      setImportError(`Couldn’t read ${file.name}: ${(e as Error).message}`);
    }
  }
  const sats = useMemo(() => [...new Set(qsos.map((q) => q.satDisplayName))].sort((a, b) => a.localeCompare(b)), [qsos]);
  const shown = filter === 'all' ? qsos : qsos.filter((q) => q.satDisplayName === filter);
  const unexported = unexportedCount(qsos);
  const grids = gridsWorked(qsos);

  async function exportAdif(which: 'new' | 'all') {
    const list = (which === 'new' ? qsos.filter((q) => q.exportedAt === null) : qsos).slice().reverse();
    if (!list.length) return;
    const now = clock.now();
    const text = toAdif(list, now);
    const stamp = formatUtc(now, true).replace(/[^0-9]/g, '').slice(0, 6);
    const name = `passband-${new Date(now).toISOString().slice(0, 10)}-${stamp}.adi`;
    const file = new File([text], name, { type: 'text/plain' });
    if (!(await shareOrDownload(file, 'Passband log'))) return;
    onExported(
      list.map((q) => q.id),
      now,
    );
  }

  return (
    <div className="stack">
      <div className="stat-row">
        <Stat label="Contacts" value={String(qsos.length)} />
        <Stat label="Grids worked" value={`${grids.size} / ${VUCC}`} hint="toward VUCC" />
      </div>

      {unexported >= EXPORT_NUDGE && (
        <Banner tone="warn">{unexported} contacts haven’t been exported. Your phone isn’t a backup — export them now.</Banner>
      )}
      {!station.callsign && qsos.length > 0 && <Banner tone="warn">Set your callsign in Settings so the export carries it.</Banner>}

      <div className="stack">
        <Button kind="primary" disabled={unexported === 0} onClick={() => void exportAdif('new')}>
          <Icon name="share" />
          Export ADIF{unexported ? ` — ${unexported} new` : ''}
        </Button>
        {qsos.length > 0 && (
          <Button kind="ghost" onClick={() => void exportAdif('all')}>
            Export all {qsos.length}
          </Button>
        )}
      </div>

      <div className="key-row">
        <Button onClick={() => setAdding(true)}>
          <Icon name="add" />
          Add contact
        </Button>
        <Button onClick={() => fileRef.current?.click()}>Import ADIF</Button>
        <input
          ref={fileRef}
          type="file"
          accept=".adi,.adif,.txt,text/plain"
          hidden
          onChange={(e) => {
            const f = e.target.files?.[0];
            e.target.value = '';
            if (f) void importFile(f);
          }}
        />
      </div>
      {imported && <Banner tone="info">{importSummary(imported)}</Banner>}
      {importError && <Banner tone="danger">{importError}</Banner>}

      {qsos.length === 0 ? (
        <p className="center muted" style={{ padding: '24px 0' }}>
          No contacts yet. Use Log on the live screen during a pass, add one by hand, or import your existing log
          (from LoTW or another logger) so your grids count toward VUCC.
        </p>
      ) : (
        <div className="stack">
          {sats.length > 1 && (
            <Select<string>
              label="Satellite"
              value={filter}
              onChange={setFilter}
              options={[{ value: 'all', label: 'All satellites' }, ...sats.map((name) => ({ value: name, label: name }))]}
            />
          )}
          <Panel>
            <ul className="rows" aria-label="Contacts">
              {shown.map((q) => {
                const problems = lotwProblems(q);
                return (
                  <li key={q.id}>
                    <button type="button" className="row" onClick={() => setEditing(q)}>
                      <span className="row-main tabular">
                        <span className="row-title row-mem">
                          {q.call}
                          {q.gridsquare && <span className="muted"> · {grid4(q.gridsquare)}</span>}
                        </span>
                        <span className="row-sub" style={{ display: 'block' }}>
                          {q.satDisplayName} · {formatLocalDay(q.timeOn)} {formatLocalTime(q.timeOn)} · {formatUtc(q.timeOn)}
                        </span>
                        {problems.length > 0 && (
                          <span className="row-sub danger-text" style={{ display: 'block' }}>
                            {problems.join(' · ')}
                          </span>
                        )}
                      </span>
                      <span className="row-end">{q.exportedAt ? 'exported' : 'new'}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </Panel>
        </div>
      )}

      <Recordings
        recordings={recordings}
        catalog={catalog.catalog}
        locations={locations}
        station={station}
        onLog={onSave}
        onDelete={onDeleteRecording}
      />

      {adding && (
        <AddQso
          sats={catalog.catalog.satellites}
          location={location}
          station={station}
          now={clock.now()}
          initialPass={contactPass}
          onClose={() => { setAdding(false); onContactPassUsed(); }}
          onSave={(q) => {
            onSave(q);
            setAdding(false);
            onContactPassUsed();
          }}
        />
      )}

      {editing && (
        <EditQso
          qso={editing}
          onClose={() => setEditing(null)}
          onSave={(q) => {
            onSave(q);
            setEditing(null);
          }}
          onDelete={() => {
            onDelete(editing.id);
            setEditing(null);
          }}
        />
      )}
    </div>
  );
}

export function importSummary(r: ImportResult): string {
  const parts = [`Imported ${r.qsos.length} satellite contact${r.qsos.length === 1 ? '' : 's'}.`];
  if (r.duplicates) parts.push(`${r.duplicates} already in the log.`);
  if (r.notSatellite) parts.push(`${r.notSatellite} non-satellite contact${r.notSatellite === 1 ? '' : 's'} left out.`);
  if (r.unreadable) parts.push(`${r.unreadable} without a callsign or time left out.`);
  if (r.qsos.length) parts.push('They count as exported, since they came from your logbook.');
  return parts.join(' ');
}

export function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="panel" style={{ padding: 8 }}>
      <div className="lcd">
        <div className="lcd-label">{label}</div>
        <div className="readout readout-l">{value}</div>
        {hint && <div className="lcd-label" style={{ fontSize: 11 }}>{hint}</div>}
      </div>
    </div>
  );
}

/** "2026-10-18 14:05:09" in UTC (D12: the log is UTC everywhere). */
export function formatUtcInput(t: number): string {
  return new Date(t).toISOString().slice(0, 19).replace('T', ' ');
}

export function parseUtcInput(s: string): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})(?::(\d{2}))?$/.exec(s.trim());
  if (!m) return null;
  const t = Date.UTC(+m[1]!, +m[2]! - 1, +m[3]!, +m[4]!, +m[5]!, +(m[6] ?? 0));
  return Number.isNaN(t) ? null : t;
}

export function EditQso({
  qso,
  onSave,
  onDelete,
  onClose,
}: {
  qso: QsoRecord;
  onSave: (q: QsoRecord) => void;
  onDelete: () => void;
  onClose: () => void;
}) {
  const [call, setCall] = useState(qso.call);
  const [grid, setGrid] = useState(qso.gridsquare ?? '');
  const [time, setTime] = useState(formatUtcInput(qso.timeOn));
  const [note, setNote] = useState(qso.note ?? '');
  const t = parseUtcInput(time);
  const gridOk = grid === '' || isValidGrid(grid);
  const ok = call.trim().length >= 3 && t !== null && gridOk;
  const [confirm, confirmNode] = useConfirm();
  return (
    <Sheet title={`Edit ${qso.call}`} onClose={onClose}>
      <Panel>
        <Field label="Their callsign" className="callsign-input" value={call} onChange={(e) => setCall(e.target.value.toUpperCase().trim())} />
        <Field label="Their grid" value={grid} maxLength={6} invalid={!gridOk} onChange={(e) => setGrid(e.target.value.trim())} />
        <Field label="Time on (UTC)" value={time} hint="YYYY-MM-DD HH:MM:SS" invalid={t === null} onChange={(e) => setTime(e.target.value)} />
        <Field label="Note" value={note} onChange={(e) => setNote(e.target.value)} />
      </Panel>
      <p className="hint mono" style={{ margin: '12px 0' }}>
        {qso.satDisplayName} · {qso.mode} · ↑ {formatMHz(qso.freqHz)} ↓ {formatMHz(qso.freqRxHz)} · from {qso.myGridsquare}
      </p>
      <div className="stack">
        <Button
          kind="primary"
          disabled={!ok}
          onClick={() =>
            onSave({
              ...qso,
              call,
              gridsquare: grid ? normaliseGrid(grid) : null,
              timeOn: t ?? qso.timeOn,
              note: note.trim() || null,
              // An edited contact needs exporting again.
              exportedAt: null,
            })
          }
        >
          Save
        </Button>
        <Button kind="danger" onClick={() => confirm({ title: `Delete the contact with ${qso.call}?`, onConfirm: onDelete })}>
          Delete
        </Button>
      </div>
      {confirmNode}
    </Sheet>
  );
}
