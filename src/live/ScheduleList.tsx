import { formatMHz } from '../model/freq';
import { IonItem, IonLabel, IonList, IonNote } from '@ionic/react';
import { formatClock, formatLocalTime } from '../model/format';
import type { RetuneSchedule } from '../model/schedule';

/** D7: the full retune schedule, for programming memory channels before AOS. */
export function ScheduleList({ schedule, aos, now }: { schedule: RetuneSchedule; aos: number; now: number }) {
  const side = schedule.tuneSide;
  if (!side) return null;
  const currentIdx = schedule.steps.findLastIndex((s) => s.t <= now);
  return (
    <div>
      <IonNote style={{ display: 'block', marginBottom: 8 }}>
        {side === 'downlink' ? 'Listen' : 'Transmit'} frequency through the pass. The other side stays put.
      </IonNote>
      <IonList inset style={{ margin: 0 }} className="tabular">
        {schedule.steps.map((s, i) => {
          const hz = side === 'downlink' ? s.downlinkHz : s.uplinkHz;
          const current = i === currentIdx;
          return (
            <IonItem key={s.t} color={current ? 'primary' : undefined} aria-current={current}>
              <IonNote slot="start" color={current ? 'light' : undefined} style={{ width: 28 }}>
                M{i + 1}
              </IonNote>
              <IonLabel>
                {i === 0 ? 'At rise' : `+${formatClock(s.t - aos)}`}
                <p>{formatLocalTime(s.t)}</p>
              </IonLabel>
              <b slot="end" className="readout" style={{ fontSize: '1.15rem' }}>
                {hz === null ? '—' : formatMHz(hz)}
              </b>
            </IonItem>
          );
        })}
      </IonList>
    </div>
  );
}
