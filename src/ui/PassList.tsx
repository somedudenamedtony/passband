import { isGoodPass, samePass } from '../model/selection';
import { Panel, SectionTitle } from './common';
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
      <SectionTitle>Coming up</SectionTitle>
      <Panel>
        <ul className="rows">
          {good.map((p) => {
            const sat = sats.get(p.noradId);
            if (!sat) return null;
            const approx = elementAgeLevel(p.elementsEpoch, now) === 'stale';
            const sel = samePass(p, selected);
            return (
              <li key={`${p.noradId}-${p.aos}`}>
                <button type="button" className="row" onClick={() => onSelect(p)} aria-pressed={sel}>
                  <span className="row-main tabular">
                    <span className="row-title row-mem">
                      {sat.name}
                      {sat.status === 'unknown' && <span title="Status unknown"> ?</span>}
                    </span>
                    <span className="row-sub" style={{ display: 'block' }}>
                      {approx && '~'}
                      {formatLocalTime(p.aos)} · {Math.round(p.maxElDeg)}°
                      {station.experience === 'experienced' && ` · ${compassPoint(p.aosAzDeg)}→${compassPoint(p.losAzDeg)}`}
                    </span>
                  </span>
                  <span className="row-end">{now >= p.aos ? 'up now' : formatCountdown(p.aos - now).replace('in ', '')}</span>
                </button>
              </li>
            );
          })}
        </ul>
      </Panel>
    </section>
  );
}
