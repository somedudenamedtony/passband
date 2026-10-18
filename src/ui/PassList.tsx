import { isGoodPass, samePass } from '../model/selection';
import { compassPoint, formatCountdown, formatLocalTime } from '../model/format';
import { elementAgeLevel } from '../model/elementAge';
import type { Pass, Satellite, Station } from '../model/types';

const SHOWN = 8;

/** The next few good passes as big tappable rows. */
export function PassList({
  passes,
  sats,
  station,
  now,
  selected,
  onSelect,
}: {
  passes: Pass[];
  sats: ReadonlyMap<number, Satellite>;
  station: Station;
  now: number;
  selected: Pass | null;
  onSelect: (p: Pass) => void;
}) {
  const good = passes.filter((p) => isGoodPass(p, station.experience)).slice(0, SHOWN);
  if (!good.length) return null;
  return (
    <section aria-label="Upcoming passes">
      <h2 className="mb-2 text-lg font-bold">Coming up</h2>
      <ul className="divide-y divide-line rounded-2xl border border-line">
        {good.map((p) => {
          const sat = sats.get(p.noradId);
          if (!sat) return null;
          const approx = elementAgeLevel(p.elementsEpoch, now) === 'stale';
          return (
            <li key={`${p.noradId}-${p.aos}`}>
              <button
                type="button"
                onClick={() => onSelect(p)}
                aria-pressed={samePass(p, selected)}
                className={`tabular flex min-h-14 w-full items-center gap-3 px-3 text-left ${
                  samePass(p, selected) ? 'bg-surface' : ''
                }`}
              >
                <span className="w-20 whitespace-nowrap font-bold">
                  {approx && '~'}
                  {formatLocalTime(p.aos)}
                </span>
                <span className="flex-1 truncate font-semibold">
                  {sat.name}
                  {sat.status === 'unknown' && <span className="text-muted" title="Status unknown"> ?</span>}
                </span>
                <span className="w-12 text-right font-bold">{Math.round(p.maxElDeg)}°</span>
                <span className="w-24 text-right text-sm text-muted">
                  {now >= p.aos ? 'up now' : formatCountdown(p.aos - now).replace('in ', '')}
                </span>
                {station.experience === 'experienced' && (
                  <span className="hidden w-16 text-right text-sm text-muted sm:inline">
                    {compassPoint(p.aosAzDeg)}→{compassPoint(p.losAzDeg)}
                  </span>
                )}
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
