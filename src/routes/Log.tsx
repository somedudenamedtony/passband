// SPEC-v2 §6.6: the log as history, grouped by pass (D23), newest first. Totals, ADIF export and
// import (D11, D12), the worked-grid map, and recordings. A contact opens at /log/:id as one sheet
// over the log, so back closes it.

import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from '../app/Link';
import { lotwProblems, toAdif } from '../model/adif';
import { importAdif, type ImportResult } from '../model/adifImport';
import { formatLocalDay, formatLocalTime, formatUtc } from '../model/format';
import { grid4 } from '../model/grid';
import { groupLog, type LogGroup } from '../model/logGroups';
import { toV1Station } from '../model/stationV2';
import type { QsoRecord } from '../model/types';
import { goUp } from '../router';
import { useBackfillPassIds } from '../store/passes';
import { store, useActiveLocation, useAppState } from '../store/store';
import { AddQso } from '../ui/AddQso';
import { useClock } from '../ui/clock';
import { Banner, Button } from '../ui/common';
import { Icon } from '../ui/icons';
import { EditQso, EXPORT_NUDGE, gridsWorked, importSummary, unexportedCount } from '../ui/LogView';
import { MapView } from '../ui/MapView';
import { Recordings } from '../ui/Recordings';
import { shareOrDownload } from '../ui/share';

const VUCC = 100;

export function LogScreen({ editing }: { editing?: string }) {
  useEffect(() => {
    void store.loadLog();
    void store.loadRecordings();
  }, []);
  useBackfillPassIds();
  const clock = useClock();
  const qsos = useAppState((s) => s.qsos);
  const recordings = useAppState((s) => s.recordings);
  const catalog = useAppState((s) => s.catalog);
  const station = useAppState((s) => s.station);
  const locations = useAppState((s) => s.locations);
  const plans = useAppState((s) => s.plans);
  const location = useActiveLocation();
  const [adding, setAdding] = useState(false);
  const [showGrids, setShowGrids] = useState(false);
  const [mapSat, setMapSat] = useState<number | null>(null);
  const [imported, setImported] = useState<ImportResult | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const groups = useMemo(() => groupLog(qsos ?? []), [qsos]);

  if (qsos === null || !station) return <p className="muted">Loading the log…</p>;
  const v1 = toV1Station(station);
  const unexported = unexportedCount(qsos);
  const grids = gridsWorked(qsos);
  const satCount = new Set(qsos.map((q) => q.satDisplayName)).size;
  const editingQso = editing ? qsos.find((q) => q.id === editing) : undefined;

  async function exportAdif(which: 'new' | 'all') {
    const list = (which === 'new' ? qsos!.filter((q) => q.exportedAt === null) : qsos!).slice().reverse();
    if (!list.length) return;
    const now = clock.now();
    const name = `passband-${new Date(now).toISOString().slice(0, 10)}-${formatUtc(now, true).replace(/[^0-9]/g, '').slice(0, 6)}.adi`;
    if (!(await shareOrDownload(new File([toAdif(list, now)], name, { type: 'text/plain' }), 'Passband log'))) return;
    await store.markExported(list.map((q) => q.id), now);
  }

  async function importFile(file: File) {
    setImportError(null);
    setImported(null);
    if (!catalog || !location) return;
    try {
      const r = importAdif(await file.text(), catalog.catalog.satellites, qsos!, v1, location, clock.now());
      if (r.qsos.length) await store.importQsos(r.qsos.map((q) => ({ ...q, passId: null })));
      setImported(r);
    } catch (e) {
      setImportError(`Couldn’t read ${file.name}: ${(e as Error).message}`);
    }
  }

  return (
    <div className="stack">
      <h1 className="screen-title">Log</h1>
      <div className="log-totals">
        <Total label="Contacts" value={qsos.length} />
        <button type="button" className="log-total" aria-expanded={showGrids} onClick={() => setShowGrids((v) => !v)}>
          <span className="lcd-label">Grids</span>
          <span className="readout">{grids.size}<small> / {VUCC}</small></span>
        </button>
        <Total label="Satellites" value={satCount} />
      </div>
      {showGrids && catalog && location && (
        <MapView catalog={catalog} location={location} station={v1} qsos={qsos} satelliteId={mapSat} onSatellite={setMapSat} />
      )}

      {unexported >= EXPORT_NUDGE && <Banner tone="warn">{unexported} contacts haven’t been exported. Your phone isn’t a backup: export them now.</Banner>}
      {!station.callsign && qsos.length > 0 && (
        <Banner tone="warn">
          Set your callsign on <Link to={{ name: 'station' }}>Station</Link> so the export carries it.
        </Banner>
      )}

      <Button kind="primary" disabled={unexported === 0} onClick={() => void exportAdif('new')}>
        <Icon name="share" />
        Export ADIF{unexported ? `: ${unexported} new` : ''}
      </Button>
      <div className="key-row">
        <Button onClick={() => setAdding(true)} disabled={!catalog || !location}>
          <Icon name="add" />
          Add contact
        </Button>
        <Button onClick={() => fileRef.current?.click()} disabled={!catalog || !location}>Import ADIF</Button>
        {qsos.length > 0 && <Button kind="ghost" onClick={() => void exportAdif('all')}>Export all {qsos.length}</Button>}
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
        <p className="muted">
          No contacts yet. Log during a pass from the live screen, add one by hand, or import your existing log (from LoTW
          or another logger) so your grids count toward VUCC.
        </p>
      ) : (
        <div className="stack" aria-label="Contacts by pass" role="list">
          {groups.map((g) => (
            <Group key={g.kind === 'pass' ? g.passId : `d${g.day}`} group={g} outcome={g.kind === 'pass' ? plans.find((p) => p.id === g.passId)?.outcome : undefined} />
          ))}
        </div>
      )}

      {recordings && catalog && (
        <Recordings recordings={recordings} catalog={catalog.catalog} locations={locations} station={v1} onLog={(q) => void store.logQso(q)} onDelete={(id) => void store.deleteRecording(id)} />
      )}

      {adding && catalog && location && (
        <AddQso
          sats={catalog.catalog.satellites}
          location={location}
          station={v1}
          now={clock.now()}
          onClose={() => setAdding(false)}
          onSave={(q) => {
            void store.logQso({ ...q, passId: undefined });
            setAdding(false);
          }}
        />
      )}
      {editingQso && (
        <EditQso
          qso={editingQso}
          onClose={goUp}
          onSave={(q) => void store.logQso(q).then(goUp)}
          onDelete={() => void store.deleteQso(editingQso.id).then(goUp)}
        />
      )}
      {editing && qsos && !editingQso && <Banner tone="warn">That contact isn’t in the log on this device.</Banner>}
    </div>
  );
}

function Total({ label, value }: { label: string; value: number }) {
  return (
    <div className="log-total">
      <span className="lcd-label">{label}</span>
      <span className="readout">{value}</span>
    </div>
  );
}

const OUTCOME_WORDS = { planned: 'planned', worked: 'worked', heard: 'heard', missed: 'missed' } as const;

function Group({ group, outcome }: { group: LogGroup; outcome?: keyof typeof OUTCOME_WORDS }) {
  const title =
    group.kind === 'pass'
      ? `${group.satDisplayName} · ${formatLocalDay(group.at)} ${formatLocalTime(group.at)}`
      : `${formatLocalDay(group.at)} ${new Date(group.at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}`;
  return (
    <section className="panel log-group" role="listitem" aria-label={title}>
      <div className="log-group-head">
        {group.kind === 'pass' ? (
          <Link to={{ name: 'pass', passId: group.passId }} className="log-group-title">{title} →</Link>
        ) : (
          <span className="log-group-title">{title}</span>
        )}
        {outcome && outcome !== 'planned' && <span className="tag">{OUTCOME_WORDS[outcome]}</span>}
      </div>
      <ul className="rows">
        {group.qsos.map((q) => (
          <ContactRow key={q.id} q={q} showSat={group.kind === 'day'} />
        ))}
      </ul>
    </section>
  );
}

function ContactRow({ q, showSat }: { q: QsoRecord; showSat: boolean }) {
  const problems = lotwProblems(q);
  return (
    <li>
      <Link to={{ name: 'contact', qsoId: q.id }} className="row log-row">
        <span className="row-main tabular">
          <span className="row-title row-mem">
            {q.call || 'Callsign?'}
            <span className="muted"> · {q.gridsquare ? grid4(q.gridsquare) : 'grid?'}</span>
          </span>
          <span className="row-sub" style={{ display: 'block' }}>
            {showSat && `${q.satDisplayName} · `}
            {formatLocalTime(q.timeOn)} · {formatUtc(q.timeOn)}
          </span>
          {problems.length > 0 && <span className="row-sub danger-text" style={{ display: 'block' }}>{problems.join(' · ')}</span>}
        </span>
        <span className="row-end">{q.exportedAt ? 'exported' : 'new'}</span>
      </Link>
    </li>
  );
}
