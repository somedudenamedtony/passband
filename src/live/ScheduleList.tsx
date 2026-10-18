import { formatMHz } from '../model/freq';
import { formatClock, formatLocalTime } from '../model/format';
import type { RetuneSchedule } from '../model/schedule';

/** D7: the full retune schedule, for programming memory channels before AOS. */
export function ScheduleList({ schedule, aos, now }: { schedule: RetuneSchedule; aos: number; now: number }) {
  const side = schedule.tuneSide;
  if (!side) return null;
  const currentIdx = schedule.steps.findLastIndex((s) => s.t <= now);
  return (
    <div>
      <p className="mb-2 text-sm text-muted">
        {side === 'downlink' ? 'Listen' : 'Transmit'} frequency through the pass. The other side stays put.
      </p>
      <ol className="tabular divide-y divide-line rounded-xl border border-line">
        {schedule.steps.map((s, i) => {
          const hz = side === 'downlink' ? s.downlinkHz : s.uplinkHz;
          return (
            <li
              key={s.t}
              className={`flex min-h-11 items-center justify-between px-3 ${i === currentIdx ? 'bg-accent font-bold text-accent-fg' : ''}`}
            >
              <span className="w-10 text-sm opacity-70">M{i + 1}</span>
              <span className="flex-1 text-sm">{i === 0 ? 'At rise' : `+${formatClock(s.t - aos)}`}</span>
              <span className="w-20 whitespace-nowrap text-sm opacity-70">{formatLocalTime(s.t)}</span>
              <span className="w-24 text-right text-lg font-bold">{hz === null ? '—' : formatMHz(hz)}</span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
