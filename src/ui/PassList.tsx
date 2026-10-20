import { useState } from 'react';
import { isGoodPass, samePass } from '../model/selection';
import { Button, Panel, SectionTitle } from './common';
import { compassPoint, formatCountdown, formatLocalTime } from '../model/format';
import { elementAgeLevel } from '../model/elementAge';
import { passOutlook } from '../model/outlook';
import type { Pass, Satellite, Station } from '../model/types';

/** Rows per page: enough to plan an evening without a long scroll. */
export const PAGE = 8;

/** The next few good passes as big tappable rows. */
export function PassList({
  passes,
  sats,
  station,
  now,
  selected,
  onSelect,
  favorites,
}: {
  passes: Pass[];
  sats: ReadonlyMap<number, Satellite>;
  station: Station;
  now: number;
  selected: Pass | null;
  onSelect: (p: Pass) => void;
  favorites?: ReadonlySet<number>;
}) {
  const [shown, setShown] = useState(PAGE);
  const all = passes.filter((p) => isGoodPass(p, station.experience));
  const good = all.slice(0, shown);
  if (!good.length) return null;
  return (
    <section aria-label="Upcoming passes">
      <SectionTitle>Coming up</SectionTitle>
      <Panel>
        <ul className="rows">
          {good.map((p) => {
            const sat = sats.get(p.noradId);
            if (!sat) return null;
            const approx = elementAgeLevel(p.elementsEpoch, now) === 'stale';
            const sel = samePass(p, selected);
            const outlook = passOutlook(p, sat, now);
            return (
              <li key={`${p.noradId}-${p.aos}`}>
                <button
                  type="button"
                  className={outlook.level === 'unlikely' ? 'row row-unlikely' : 'row'}
                  onClick={() => onSelect(p)}
                  aria-pressed={sel}
                >
                  <span className="row-main tabular">
                    <span className="row-title row-mem">
                      {favorites?.has(sat.noradId) && <span aria-label="Favorite">★ </span>}
                      {sat.name}
                      {sat.status === 'unknown' && <span title="Status unknown"> ?</span>}
                    </span>
                    <span className="row-sub" style={{ display: 'block' }}>
                      {approx && '~'}
                      {formatLocalTime(p.aos)} · {Math.round(p.maxElDeg)}°
                      {station.experience === 'experienced' && ` · ${compassPoint(p.aosAzDeg)}→${compassPoint(p.losAzDeg)}`}
                      {outlook.level !== 'likely' && outlook.short && <span className="row-flag"> · {outlook.short}</span>}
                    </span>
                  </span>
                  <span className="row-end">{now >= p.aos ? 'up now' : formatCountdown(p.aos - now).replace('in ', '')}</span>
                </button>
              </li>
            );
          })}
        </ul>
      </Panel>
      {all.length > shown && (
        <Button kind="ghost" onClick={() => setShown((n) => n + PAGE)}>
          Show {Math.min(PAGE, all.length - shown)} more ({all.length} in all)
        </Button>
      )}
    </section>
  );
}
