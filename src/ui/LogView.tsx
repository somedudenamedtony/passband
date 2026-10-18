// §5.4: the log. Newest first, filter by satellite, ADIF export (D11, D12), grids toward VUCC.

import { useMemo, useState } from 'react';
import { lotwProblems, toAdif } from '../model/adif';
import { formatMHz } from '../model/freq';
import { formatLocalDay, formatLocalTime, formatUtc } from '../model/format';
import { grid4, isValidGrid, normaliseGrid } from '../model/grid';
import type { LoadedCatalog } from '../data/catalog';
import type { Location, QsoRecord, Recording, Station } from '../model/types';
import { Recordings } from './Recordings';
import { shareOrDownload } from './share';

type Catalog = LoadedCatalog;
import { Banner, Button, Sheet } from './common';
import { IonIcon, IonInput, IonItem, IonLabel, IonList, IonNote, IonSelect, IonSelectOption, IonText, useIonAlert } from '@ionic/react';
import { shareOutline } from 'ionicons/icons';
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

      <div>
        <Button kind="primary" disabled={unexported === 0} onClick={() => void exportAdif('new')}>
          <IonIcon slot="start" icon={shareOutline} aria-hidden />
          Export ADIF{unexported ? ` — ${unexported} new` : ''}
        </Button>
        {qsos.length > 0 && (
          <Button kind="ghost" onClick={() => void exportAdif('all')}>
            Export all {qsos.length}
          </Button>
        )}
      </div>

      {qsos.length === 0 ? (
        <p className="ion-text-center muted" style={{ padding: '24px 0' }}>
          No contacts yet. Use Log on the live screen during a pass.
        </p>
      ) : (
        <IonList inset style={{ margin: 0 }} aria-label="Contacts">
          {sats.length > 1 && (
            <IonItem>
              <IonSelect
                label="Satellite"
                value={String(filter)}
                interface="action-sheet"
                onIonChange={(e) => setFilter(e.detail.value === 'all' ? 'all' : Number(e.detail.value))}
              >
                <IonSelectOption value="all">All satellites</IonSelectOption>
                {sats.map(([id, name]) => (
                  <IonSelectOption key={id} value={String(id)}>
                    {name}
                  </IonSelectOption>
                ))}
              </IonSelect>
            </IonItem>
          )}
          {shown.map((q) => {
            const problems = lotwProblems(q);
            return (
              <IonItem key={q.id} button onClick={() => setEditing(q)}>
                <IonLabel className="tabular">
                  <h2 style={{ fontWeight: 700 }}>
                    {q.call}
                    {q.gridsquare && <span className="muted" style={{ fontWeight: 400 }}> · {grid4(q.gridsquare)}</span>}
                  </h2>
                  <p>
                    {q.satDisplayName} · {formatLocalDay(q.timeOn)} {formatLocalTime(q.timeOn)} · {formatUtc(q.timeOn)}
                  </p>
                  {problems.length > 0 && (
                    <IonText color="danger">
                      <p>{problems.join(' · ')}</p>
                    </IonText>
                  )}
                </IonLabel>
                <IonNote slot="end">{q.exportedAt ? 'exported' : 'new'}</IonNote>
              </IonItem>
            );
          })}
        </IonList>
      )}

      <Recordings
        recordings={recordings}
        catalog={catalog.catalog}
        locations={locations}
        station={station}
        onLog={onSave}
        onDelete={onDeleteRecording}
      />

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

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="freq-panel">
      <IonNote>{label}</IonNote>
      <div className="readout readout-l">{value}</div>
      {hint && <IonNote style={{ fontSize: '0.75rem' }}>{hint}</IonNote>}
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
  const [confirm] = useIonAlert();
  return (
    <Sheet title={`Edit ${qso.call}`} onClose={onClose}>
      <IonList inset>
        <IonItem>
          <IonInput label="Their callsign" labelPlacement="stacked" value={call} className="callsign-input" onIonInput={(e) => setCall((e.detail.value ?? '').toUpperCase().trim())} />
        </IonItem>
        <IonItem>
          <IonInput label="Their grid" labelPlacement="stacked" value={grid} maxlength={6} aria-invalid={!gridOk} onIonInput={(e) => setGrid((e.detail.value ?? '').trim())} />
        </IonItem>
        <IonItem>
          <IonInput
            label="Time on (UTC)"
            labelPlacement="stacked"
            className="tabular"
            value={time}
            helperText="YYYY-MM-DD HH:MM:SS"
            aria-invalid={t === null}
            onIonInput={(e) => setTime(e.detail.value ?? '')}
          />
        </IonItem>
        <IonItem>
          <IonInput label="Note" labelPlacement="stacked" value={note} onIonInput={(e) => setNote(e.detail.value ?? '')} />
        </IonItem>
      </IonList>
      <IonNote className="tabular ion-padding-horizontal" style={{ display: 'block' }}>
        {qso.satDisplayName} · {qso.mode} · ↑ {formatMHz(qso.freqHz)} ↓ {formatMHz(qso.freqRxHz)} · from {qso.myGridsquare}
      </IonNote>
      <div className="ion-padding">
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
        <Button
          kind="ghost"
          color="danger"
          onClick={() =>
            void confirm({
              header: `Delete the contact with ${qso.call}?`,
              buttons: [
                { text: 'Cancel', role: 'cancel' },
                { text: 'Delete', role: 'destructive', handler: onDelete },
              ],
            })
          }
        >
          Delete
        </Button>
      </div>
    </Sheet>
  );
}
