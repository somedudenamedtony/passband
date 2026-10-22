// SPEC-v2 D26: one pass row everywhere, with fixed slots: when, what, how good, where, status.
// And the small marks it's made of, shared with the pass page so a pass looks the same on both.

import { elementAgeLevel, formatElementAge } from '../model/elementAge';
import { formatLocalTime, formatLocalTimeShort } from '../model/format';
import { modeGuide, type ModeGuide } from '../model/modes';
import { operatingTransmitter } from '../model/operator';
import { passOutlook, type Outlook } from '../model/outlook';
import { passId } from '../model/passId';
import { direction, QUALITY_STEPS, quality, type Quality } from '../model/passView';
import { toV1Station, type StationV2 } from '../model/stationV2';
import type { Pass, Satellite, Transmitter } from '../model/types';
import { Link } from '../app/Link';
import { Icon } from '../ui/icons';

export interface PassFacts {
  pass: Pass;
  sat: Satellite;
  tx: Transmitter | null;
  /** null when the transmitter is unknown: the chip says Unknown (D6). */
  guide: ModeGuide | null;
  quality: Quality;
  outlook: Outlook;
  stale: boolean;
}

export function passFacts(pass: Pass, sat: Satellite, station: StationV2, now: number): PassFacts {
  const tx = operatingTransmitter(sat, toV1Station(station));
  return {
    pass,
    sat,
    tx,
    guide: tx ? modeGuide(tx) : null,
    quality: quality(pass.maxElDeg, station.qualityThresholdsDeg),
    outlook: passOutlook(pass, sat, now),
    stale: elementAgeLevel(pass.elementsEpoch, now) === 'stale',
  };
}

export function ModeChip({ guide }: { guide: ModeGuide | null }) {
  return <span className="mode-chip">{guide?.label ?? 'Unknown'}</span>;
}

export function QualityBar({ q }: { q: Quality }) {
  const lit = QUALITY_STEPS[q];
  return (
    <span className={`qbar qbar-${q}`} role="img" aria-label={`${q} pass`}>
      {[1, 2, 3].map((i) => (
        <span key={i} className={i <= lit ? 'on' : undefined} />
      ))}
    </span>
  );
}

const ON_AIR = {
  likely: { words: 'probably on' },
  uncertain: { words: 'may be on' },
  unlikely: { words: 'probably off' },
} as const;

/** Full, half, empty: readable without colour. */
const ON_AIR_FILL = { likely: 'M7 1a6 6 0 1 1 0 12A6 6 0 0 1 7 1z', uncertain: 'M7 1a6 6 0 0 0 0 12z', unlikely: '' } as const;

/** D21, by shape as well as colour. */
export function OnAirMark({ outlook }: { outlook: Outlook }) {
  const m = ON_AIR[outlook.level];
  return (
    <span className={`onair onair-${outlook.level}`} role="img" aria-label={`${m.words}${outlook.short ? `: ${outlook.short}` : ''}`}>
      <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true">
        <circle cx="7" cy="7" r="5.6" fill="none" stroke="currentColor" strokeWidth="1.6" />
        {ON_AIR_FILL[outlook.level] && <path d={ON_AIR_FILL[outlook.level]} fill="currentColor" />}
      </svg>
    </span>
  );
}

export function PassRow({ facts, now, planned, onTogglePlan }: { facts: PassFacts; now: number; planned: boolean; onTogglePlan: () => void }) {
  const { pass, sat, guide, outlook, stale } = facts;
  const up = now >= pass.aos && now < pass.los;
  const time = up ? 'UP' : formatLocalTimeShort(pass.aos);
  const el = Math.round(pass.maxElDeg);
  return (
    <li className={`pass-row${outlook.level === 'unlikely' ? ' pass-row-unlikely' : ''}`}>
      <Link
        to={{ name: 'pass', passId: passId(pass.noradId, pass.aos) }}
        className="pass-row-link"
        aria-label={`${sat.name}, ${up ? 'up now' : formatLocalTime(pass.aos)}, ${guide?.label ?? 'mode Unknown'}, ${el}°, ${direction(pass)}`}
      >
        <span className={`pr-when mono${up ? ' pr-up' : ''}`}>{time}</span>
        <span className="pr-what">
          <span className="pr-name">{sat.name}</span>
          <ModeChip guide={guide} />
        </span>
        <span className="pr-el mono">
          <QualityBar q={facts.quality} />
          {el}°
        </span>
        <span className="pr-dir mono">{direction(pass).replace(' → ', '→')}</span>
        <span className="pr-status">
          <OnAirMark outlook={outlook} />
          {stale && (
            <span role="img" aria-label={`Elements ${formatElementAge(pass.elementsEpoch, now)}`} className="pr-stale">
              <Icon name="warning" size={14} />
            </span>
          )}
        </span>
      </Link>
      <button
        type="button"
        className="pr-plan"
        aria-pressed={planned}
        aria-label={`Going: ${sat.name} at ${formatLocalTime(pass.aos)}`}
        onClick={onTogglePlan}
      >
        <Icon name="star" size={18} filled={planned} />
      </button>
    </li>
  );
}
