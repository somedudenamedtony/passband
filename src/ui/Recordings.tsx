// D13 / §5.4: recordings with "log at this moment" during playback.

import { useEffect, useMemo, useRef, useState } from 'react';
import { storageUse, type StorageUse } from '../data/recordings';
import { exactAt } from '../model/schedule';
import { fmTuning } from '../model/doppler';
import { formatClock, formatLocalDay, formatLocalTime, formatUtc } from '../model/format';
import type { Catalog, Location, QsoRecord, Recording, Station } from '../model/types';
import { rangeRateAt } from '../predict/client';
import type { RigSetting } from '../rig/rig';
import { Banner, Button, SectionTitle } from './common';
import { IonButton, IonIcon, IonItem, IonLabel, IonList, IonNote, useIonAlert } from '@ionic/react';
import { addOutline, playOutline, trashOutline } from 'ionicons/icons';
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
  const [confirm] = useIonAlert();
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
    <section aria-label="Recordings">
      <SectionTitle>Recordings</SectionTitle>
      <IonNote style={{ display: 'block', marginBottom: 8 }}>
        {recordings.length} recording{recordings.length === 1 ? '' : 's'}, {formatBytes(use?.recordingsBytes ?? 0)}
        {use?.quotaBytes != null && use.usedBytes != null && ` · ${formatBytes(use.usedBytes)} of ${formatBytes(use.quotaBytes)} used on this device`}
      </IonNote>
      <IonList inset style={{ margin: 0 }}>
        {recordings.map((r) => (
          <IonItem key={r.id} lines="full">
            <IonLabel className="tabular" style={{ whiteSpace: 'normal' }}>
              <h2 style={{ fontWeight: 700 }}>{r.satDisplayName}</h2>
              <p>
                {formatLocalDay(r.startedAt)} {formatLocalTime(r.startedAt)} · {formatClock(r.durationMs)}
                {r.interrupted && ' · interrupted (screen locked or app backgrounded)'}
              </p>
              {playing?.id === r.id && url && (
                <div className="stack" style={{ marginTop: 8 }}>
                  <audio ref={audio} src={url} controls autoPlay style={{ width: '100%' }} onTimeUpdate={(e) => setPos(e.currentTarget.currentTime)} />
                  <div className="readout readout-m ion-text-center" aria-live="off">
                    {formatUtc(r.startedAt + pos * 1000, true)}
                  </div>
                  <Button kind="primary" onClick={() => void logAtThisMoment(r)}>
                    <IonIcon slot="start" icon={addOutline} aria-hidden />
                    Log at this moment
                  </Button>
                </div>
              )}
            </IonLabel>
            {playing?.id !== r.id && (
              <>
                <IonButton slot="end" fill="clear" onClick={() => { setPos(0); setPlaying(r); }} aria-label="Play">
                  <IonIcon slot="icon-only" icon={playOutline} aria-hidden />
                </IonButton>
                <IonButton
                  slot="end"
                  fill="clear"
                  color="medium"
                  aria-label={`Delete ${r.satDisplayName} recording`}
                  onClick={() =>
                    void confirm({
                      header: `Delete this ${r.satDisplayName} recording?`,
                      buttons: [
                        { text: 'Cancel', role: 'cancel' },
                        { text: 'Delete', role: 'destructive', handler: () => onDelete(r.id) },
                      ],
                    })
                  }
                >
                  <IonIcon slot="icon-only" icon={trashOutline} aria-hidden />
                </IonButton>
              </>
            )}
          </IonItem>
        ))}
      </IonList>
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
        <Banner tone="warn">That satellite or location is no longer on this device, so this moment can’t be logged.</Banner>
      )}
    </section>
  );
}
