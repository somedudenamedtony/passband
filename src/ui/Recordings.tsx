// D13 / §5.4: recordings with "log at this moment" during playback.

import { useEffect, useMemo, useRef, useState } from 'react';
import { storageUse, type StorageUse } from '../data/recordings';
import { exactAt } from '../model/schedule';
import { fmTuning } from '../model/doppler';
import { formatClock, formatLocalDay, formatLocalTime, formatUtc } from '../model/format';
import type { Catalog, Location, QsoRecord, Recording, Station } from '../model/types';
import { rangeRateAt } from '../predict/client';
import type { RigSetting } from '../rig/rig';
import { Button } from './common';
import { QuickLog } from './QuickLog';
import { formatBytes } from './share';

interface Pending {
  recording: Recording;
  timeOn: number;
  setting: RigSetting | null;
}

export function Recordings({
  recordings,
  catalog,
  locations,
  station,
  onLog,
  onDelete,
}: {
  recordings: Recording[];
  catalog: Catalog;
  locations: Location[];
  station: Station;
  onLog: (q: QsoRecord) => void;
  onDelete: (id: string) => void;
}) {
  const [playing, setPlaying] = useState<Recording | null>(null);
  const [pos, setPos] = useState(0);
  const [pending, setPending] = useState<Pending | null>(null);
  const [use, setUse] = useState<StorageUse | null>(null);
  const audio = useRef<HTMLAudioElement | null>(null);
  const url = useMemo(() => (playing ? URL.createObjectURL(playing.blob) : null), [playing]);
  useEffect(() => () => (url ? URL.revokeObjectURL(url) : undefined), [url]);
  useEffect(() => {
    void storageUse(recordings).then(setUse);
  }, [recordings]);

  const pendingSat = pending ? catalog.satellites.find((s) => s.noradId === pending.recording.noradId) : undefined;
  const pendingTx = pendingSat?.transmitters.find((t) => t.id === pending?.recording.transmitterId) ?? pendingSat?.transmitters[0];
  const pendingLoc = pending ? locations.find((l) => l.id === pending.recording.locationId) : undefined;

  async function logAtThisMoment(r: Recording) {
    const timeOn = Math.round(r.startedAt + (audio.current?.currentTime ?? 0) * 1000);
    audio.current?.pause();
    const sat = catalog.satellites.find((s) => s.noradId === r.noradId);
    const tx = sat?.transmitters.find((t) => t.id === r.transmitterId);
    const loc = locations.find((l) => l.id === r.locationId);
    let setting: RigSetting | null = null;
    // The frequencies that were right at that moment, from the pass geometry (D7).
    if (sat && tx && loc) {
      const rr = await rangeRateAt(sat, loc, timeOn);
      if (rr !== null) {
        const f = tx.kind === 'fm_repeater' ? fmTuning(tx, rr, station.radioStepHz) : exactAt(tx, rr);
        setting = { uplinkHz: f.uplinkHz, downlinkHz: f.downlinkHz, ctcssHz: tx.ctcssHz };
      }
    }
    setPending({ recording: r, timeOn, setting });
  }

  if (!recordings.length) return null;

  return (
    <section aria-label="Recordings" className="space-y-2">
      <h2 className="text-lg font-bold">Recordings</h2>
      <p className="text-sm text-muted">
        {recordings.length} recording{recordings.length === 1 ? '' : 's'}, {formatBytes(use?.recordingsBytes ?? 0)}
        {use?.quotaBytes != null && use.usedBytes != null && ` · ${formatBytes(use.usedBytes)} of ${formatBytes(use.quotaBytes)} used on this device`}
      </p>
      <ul className="divide-y divide-line rounded-2xl border border-line">
        {recordings.map((r) => (
          <li key={r.id} className="space-y-2 p-3">
            <div className="tabular flex items-baseline justify-between gap-2">
              <span className="font-bold">{r.satDisplayName}</span>
              <span className="text-sm text-muted">
                {formatLocalDay(r.startedAt)} {formatLocalTime(r.startedAt)} · {formatClock(r.durationMs)}
              </span>
            </div>
            {r.interrupted && <p className="text-sm font-semibold">Interrupted — the screen locked or the app was backgrounded.</p>}
            {playing?.id === r.id && url ? (
              <>
                <audio
                  ref={audio}
                  src={url}
                  controls
                  autoPlay
                  className="w-full"
                  onTimeUpdate={(e) => setPos(e.currentTarget.currentTime)}
                />
                <p className="tabular text-center font-bold" aria-live="off">
                  {formatUtc(r.startedAt + pos * 1000, true)}
                </p>
                <Button kind="primary" className="w-full" onClick={() => void logAtThisMoment(r)}>
                  + Log at this moment
                </Button>
              </>
            ) : (
              <div className="flex gap-2">
                <Button className="flex-1" onClick={() => { setPos(0); setPlaying(r); }}>
                  ▶ Play
                </Button>
                <Button
                  onClick={() => {
                    if (confirm(`Delete this ${r.satDisplayName} recording?`)) onDelete(r.id);
                  }}
                  aria-label={`Delete ${r.satDisplayName} recording`}
                >
                  🗑
                </Button>
              </div>
            )}
          </li>
        ))}
      </ul>
      {pending && pendingSat && pendingTx && pendingLoc && (
        <QuickLog
          sat={pendingSat}
          tx={pendingTx}
          setting={pending.setting}
          location={pendingLoc}
          station={station}
          timeOn={pending.timeOn}
          onClose={() => setPending(null)}
          onSave={(q) => {
            onLog({ ...q, recordingId: pending.recording.id });
            setPending(null);
          }}
        />
      )}
      {pending && !(pendingSat && pendingTx && pendingLoc) && (
        <p className="text-sm font-semibold">That satellite or location is no longer on this device, so this moment can’t be logged.</p>
      )}
    </section>
  );
}
