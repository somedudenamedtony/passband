import { formatMHz } from '../model/freq';
import { formatClock, formatLocalTime } from '../model/format';
import type { RetuneSchedule } from '../model/schedule';

/** D7: the full retune schedule, for programming memory channels before AOS. */
export function ScheduleList({ schedule, aos, now, listenOnly = false }: { schedule: RetuneSchedule; aos: number; now: number; listenOnly?: boolean }) {
  const side = schedule.tuneSide;
  if (!side) return null;
  const currentIdx = schedule.steps.findLastIndex((s) => s.t <= now);
  return (
    <div>
      <p className="hint" style={{ marginBottom: 8 }}>
        {side === 'downlink' ? 'Listen' : 'Transmit'} frequency through the pass.{!listenOnly && ' The other side stays put.'}
      </p>
      <div className="panel">
        <ul className="rows tabular">
          {schedule.steps.map((s, i) => {
            const hz = side === 'downlink' ? s.downlinkHz : s.uplinkHz;
            const current = i === currentIdx;
            return (
              <li key={s.t} className={`row${current ? ' row-current' : ''}`} aria-current={current}>
                <span className="row-mem" style={{ width: 32 }}>
                  M{i + 1}
                </span>
                <span className="row-main">
                  <span style={{ display: 'block' }}>{i === 0 ? 'At rise' : `+${formatClock(s.t - aos)}`}</span>
                  <span className="row-sub">{formatLocalTime(s.t)}</span>
                </span>
                <span className="readout readout-s" style={{ color: current ? 'var(--amber)' : undefined }}>
                  {hz === null ? '—' : formatMHz(hz)}
                </span>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
