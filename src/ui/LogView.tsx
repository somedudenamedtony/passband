// §5.4: the log. Newest first, filter by satellite, ADIF export (D11, D12), grids toward VUCC.

import { useMemo, useState } from 'react';
import { lotwProblems, toAdif } from '../model/adif';
import { formatMHz } from '../model/freq';
import { formatLocalDay, formatLocalTime, formatUtc } from '../model/format';
import { grid4, isValidGrid, normaliseGrid } from '../model/grid';
import type { QsoRecord, Station } from '../model/types';
import { Banner, Button, Field, Sheet, inputClass } from './common';
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
}: {
  qsos: QsoRecord[];
  station: Station;
  onSave: (q: QsoRecord) => void;
  onDelete: (id: string) => void;
  onExported: (ids: string[], at: number) => void;
}) {
  const clock = useClock();
  const [filter, setFilter] = useState<number | 'all'>('all');
  const [editing, setEditing] = useState<QsoRecord | null>(null);
  const sats = useMemo(() => {
    const m = new Map<number, string>();
    for (const q of qsos) m.set(q.satNoradId, q.satDisplayName);
    return [...m].sort((a, b) => a[1].localeCompare(b[1]));
  }, [qsos]);
  const shown = filter === 'all' ? qsos : qsos.filter((q) => q.satNoradId === filter);
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
    // §6: share sheet where the platform has one (iOS especially), a download otherwise.
    if (navigator.canShare?.({ files: [file] })) {
      try {
        await navigator.share({ files: [file], title: 'Passband log' });
      } catch (e) {
        if ((e as DOMException).name === 'AbortError') return;
        download(file);
      }
    } else {
      download(file);
    }
    onExported(
      list.map((q) => q.id),
      now,
    );
  }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Log</h1>

      <div className="grid grid-cols-2 gap-3">
        <Stat label="Contacts" value={String(qsos.length)} />
        <Stat label="Grids worked" value={`${grids.size} / ${VUCC}`} hint="toward VUCC" />
      </div>

      {unexported >= EXPORT_NUDGE && (
        <Banner tone="warn">
          {unexported} contacts haven’t been exported. Your phone isn’t a backup — export them now.
        </Banner>
      )}
      {!station.callsign && qsos.length > 0 && (
        <Banner tone="warn">Set your callsign in Settings so the export carries it.</Banner>
      )}

      <div className="flex flex-col gap-2">
        <Button kind="primary" disabled={unexported === 0} onClick={() => void exportAdif('new')}>
          Export ADIF{unexported ? ` — ${unexported} new` : ''}
        </Button>
        {qsos.length > 0 && <Button onClick={() => void exportAdif('all')}>Export all {qsos.length}</Button>}
      </div>

      {sats.length > 1 && (
        <Field label="Satellite">
          <select
            className={inputClass}
            value={filter}
            onChange={(e) => setFilter(e.target.value === 'all' ? 'all' : Number(e.target.value))}
          >
            <option value="all">All satellites</option>
            {sats.map(([id, name]) => (
              <option key={id} value={id}>
                {name}
              </option>
            ))}
          </select>
        </Field>
      )}

      {qsos.length === 0 ? (
        <p className="py-6 text-center text-muted">No contacts yet. Use + LOG on the live screen during a pass.</p>
      ) : (
        <ul className="divide-y divide-line rounded-2xl border border-line" aria-label="Contacts">
          {shown.map((q) => {
            const problems = lotwProblems(q);
            return (
              <li key={q.id}>
                <button type="button" onClick={() => setEditing(q)} className="tabular flex min-h-14 w-full items-center gap-3 px-3 py-2 text-left">
                  <div className="flex-1">
                    <div className="text-lg font-bold">
                      {q.call}
                      {q.gridsquare && <span className="font-normal text-muted"> · {grid4(q.gridsquare)}</span>}
                    </div>
                    <div className="text-sm text-muted">
                      {q.satDisplayName} · {formatLocalDay(q.timeOn)} {formatLocalTime(q.timeOn)} · {formatUtc(q.timeOn)}
                    </div>
                    {problems.length > 0 && <div className="text-sm font-semibold text-danger-fg">{problems.join(' · ')}</div>}
                  </div>
                  <span className="text-xs text-muted">{q.exportedAt ? 'exported' : 'new'}</span>
                </button>
              </li>
            );
          })}
        </ul>
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

function download(file: File) {
  const url = URL.createObjectURL(file);
  const a = document.createElement('a');
  a.href = url;
  a.download = file.name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-2xl border border-line bg-surface p-3">
      <div className="text-sm text-muted">{label}</div>
      <div className="tabular text-3xl font-black">{value}</div>
      {hint && <div className="text-xs text-muted">{hint}</div>}
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

function EditQso({
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
  return (
    <Sheet title={`Edit ${qso.call}`} onClose={onClose}>
      <div className="space-y-4">
        <Field label="Their callsign">
          <input className={`${inputClass} uppercase`} value={call} onChange={(e) => setCall(e.target.value.toUpperCase().trim())} />
        </Field>
        <Field label="Their grid">
          <input className={`${inputClass}`} value={grid} maxLength={6} onChange={(e) => setGrid(e.target.value.trim())} aria-invalid={!gridOk} />
        </Field>
        <Field label="Time on (UTC)" hint="YYYY-MM-DD HH:MM:SS">
          <input className={`${inputClass} tabular`} value={time} onChange={(e) => setTime(e.target.value)} aria-invalid={t === null} />
        </Field>
        <Field label="Note">
          <input className={inputClass} value={note} onChange={(e) => setNote(e.target.value)} />
        </Field>
        <p className="tabular text-sm text-muted">
          {qso.satDisplayName} · {qso.mode} · ↑ {formatMHz(qso.freqHz)} ↓ {formatMHz(qso.freqRxHz)} · from {qso.myGridsquare}
        </p>
        <Button
          kind="primary"
          className="w-full"
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
        <Button
          className="w-full"
          onClick={() => {
            if (confirm(`Delete the contact with ${qso.call}?`)) onDelete();
          }}
        >
          Delete
        </Button>
      </div>
    </Sheet>
  );
}
