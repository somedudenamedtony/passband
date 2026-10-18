import { isGoodPass, samePass } from '../model/selection';
import { IonItem, IonLabel, IonList, IonNote } from '@ionic/react';
import { SectionTitle } from './common';
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
      <IonList inset style={{ margin: 0 }}>
        {good.map((p) => {
          const sat = sats.get(p.noradId);
          if (!sat) return null;
          const approx = elementAgeLevel(p.elementsEpoch, now) === 'stale';
          const sel = samePass(p, selected);
          return (
            <IonItem
              key={`${p.noradId}-${p.aos}`}
              button
              detail={false}
              onClick={() => onSelect(p)}
              aria-pressed={sel}
              color={sel ? 'light' : undefined}
            >
              <IonLabel className="tabular">
                <h2 style={{ fontWeight: 700 }}>
                  {sat.name}
                  {sat.status === 'unknown' && <span className="muted" title="Status unknown"> ?</span>}
                  {' '}
                  <span className="muted" style={{ fontWeight: 400 }}>
                    · {Math.round(p.maxElDeg)}°
                  </span>
                </h2>
                <p>
                  {approx && '~'}
                  {formatLocalTime(p.aos)}
                  {station.experience === 'experienced' && ` · ${compassPoint(p.aosAzDeg)}→${compassPoint(p.losAzDeg)}`}
                </p>
              </IonLabel>
              <IonNote slot="end" className="tabular">
                {now >= p.aos ? 'up now' : formatCountdown(p.aos - now).replace('in ', '')}
              </IonNote>
            </IonItem>
          );
        })}
      </IonList>
    </section>
  );
}
