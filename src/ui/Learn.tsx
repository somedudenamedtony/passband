// §5.5: the first-contact guide, things to hear tonight, and practice (D16).
// D19: open by default for new operators; folded away under Help for experienced ones.

import { useMemo, type ReactNode } from 'react';
import type { LoadedCatalog } from '../data/catalog';
import { formatMHz, formatTone } from '../model/freq';
import { compassWord, formatCountdown, formatLocalDay, formatLocalTime } from '../model/format';
import { grid4 } from '../model/grid';
import { listeningTransmitter, whatYoullHear } from '../model/listen';
import { easiestPass, isDefaultListed } from '../model/selection';
import { HOUR } from '../model/time';
import { primaryTransmitter } from '../model/transmitters';
import type { Location, Pass, Satellite, Station } from '../model/types';
import { Button } from './common';
import { useNow } from './clock';
import { usePasses } from './usePasses';

const LOOKBACK = 12 * HOUR;

export function Learn({
  catalog,
  location,
  station,
  onPick,
  onPractice,
}: {
  catalog: LoadedCatalog;
  location: Location;
  station: Station;
  onPick: (pass: Pass) => void;
  onPractice: (pass: Pass, sat: Satellite) => void;
}) {
  const now = useNow(30_000);
  const isNew = station.experience === 'new';
  const sats = useMemo(
    () =>
      catalog.catalog.satellites.filter(
        (s) => s.status !== 'inactive' && (s.overlay.curated || s.overlay.receiveOnly || isDefaultListed(s, 'new')),
      ),
    [catalog],
  );
  const byId = useMemo(() => new Map(sats.map((s) => [s.noradId, s])), [sats]);
  const { passes } = usePasses(sats, location, LOOKBACK);
  const easiest = passes ? easiestPass(passes, byId, now) : null;
  const easiestSat = easiest ? byId.get(easiest.noradId) : undefined;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">{isNew ? 'Learn' : 'Help'}</h1>

      <Section title="Your first contact" open={isNew}>
        <h3 className="mt-2 font-bold">1. Gear</h3>
        <ul className="ml-5 list-disc space-y-1">
          <li>A dual-band FM radio that can transmit on one band while listening on the other. A common handheld works.</li>
          <li>A small hand-held directional antenna for 2 m and 70 cm. The rubber duck that came with the radio rarely works.</li>
          <li>Earphones, so the downlink doesn’t feed back into your microphone.</li>
          <li>The frequencies and tone programmed into memory channels before the pass. The live screen lists them.</li>
        </ul>

        <h3 className="mt-4 font-bold">2. Pick a pass</h3>
        <p>
          Start with an easy FM satellite on a high pass: it’s up for longer, louder, and easier to point at.
        </p>
        {passes === null ? (
          <p className="text-muted">Working out passes…</p>
        ) : easiest && easiestSat ? (
          <div className="mt-2 rounded-xl border border-line bg-surface p-3">
            <p className="font-semibold">
              {easiestSat.name}, {formatLocalDay(easiest.aos)} {formatLocalTime(easiest.aos)} (
              {formatCountdown(easiest.aos - now)}), up to {Math.round(easiest.maxElDeg)}°, rising in the{' '}
              {compassWord(easiest.aosAzDeg)}.
            </p>
            <Button kind="primary" className="mt-2 w-full" onClick={() => onPick(easiest)}>
              Use this pass
            </Button>
          </div>
        ) : (
          <p className="text-muted">No easy pass in the next 24 hours from {location.name}.</p>
        )}

        <h3 className="mt-4 font-bold">3. Listen first</h3>
        <p>
          When the satellite rises, listen. You should hear other stations before you say anything. If you can’t hear
          the satellite, nobody can hear you through it — <b>never transmit until you hear the downlink.</b>
        </p>

        <h3 className="mt-4 font-bold">4. What to say</h3>
        <p>Wait for a gap, then give your callsign and grid square, once:</p>
        <Script>
          {callsign(station)}, {grid4(location.grid6)}
        </Script>
        <p>If someone answers with their call and grid, reply with theirs and yours, then let others in:</p>
        <Script>
          K1ABC, {callsign(station)}, thanks, {grid4(location.grid6)}
        </Script>
        <p className="text-sm text-muted">
          K1ABC stands in for whoever answers.{!station.callsign && ' Set your own callsign in Settings.'}
        </p>

        <h3 className="mt-4 font-bold">5. Etiquette</h3>
        <ul className="ml-5 list-disc space-y-1">
          <li>Listen before you transmit, every time.</li>
          <li>Callsign and grid, nothing more. A pass lasts ten minutes and everyone wants a turn.</li>
          <li>Don’t call over someone. Wait for a gap.</li>
          <li>One contact per pass is plenty on a busy FM satellite.</li>
          <li>Retune as the satellite moves; the live screen tells you when.</li>
        </ul>

        <h3 className="mt-4 font-bold">6. What success sounds like</h3>
        <p>
          You key up, give your call, and a moment later hear your own voice come back from the satellite, a little
          delayed. Then someone says your callsign. That’s a contact — log their call, their grid and the time.
        </p>
      </Section>

      <Section title="Listen tonight" open>
        <p className="text-sm text-muted">No licence needed to listen. Any radio or SDR that covers the frequency will do.</p>
        <ListenList sats={sats} passes={passes} now={now} />
      </Section>

      <Section title="Practice a pass" open={isNew}>
        <p>
          Run a real pass — one coming up or one from earlier today — through the live screen on a simulated clock, at
          normal speed or faster. A practice tone stands in for the satellite so you can learn to retune by ear.
        </p>
        <PracticeList passes={passes} sats={byId} station={station} now={now} onPractice={onPractice} />
      </Section>
    </div>
  );
}

function callsign(station: Station): string {
  return station.callsign || 'W7LIT';
}

function Section({ title, open, children }: { title: string; open: boolean; children: ReactNode }) {
  return (
    <details open={open} className="rounded-2xl border border-line p-4 [&_p]:mt-2">
      <summary className="min-h-10 cursor-pointer text-xl font-bold">{title}</summary>
      {children}
    </details>
  );
}

function Script({ children }: { children: ReactNode }) {
  return <p className="mt-2 rounded-xl bg-surface px-4 py-3 text-xl font-bold">“{children}”</p>;
}

function ListenList({ sats, passes, now }: { sats: Satellite[]; passes: Pass[] | null; now: number }) {
  if (!passes) return <p className="text-muted">Working out passes…</p>;
  const rows = sats
    .map((s) => ({ sat: s, tx: listeningTransmitter(s), next: passes.find((p) => p.noradId === s.noradId && p.los > now && p.maxElDeg >= 15) }))
    .filter((r): r is { sat: Satellite; tx: NonNullable<typeof r.tx>; next: Pass } => r.tx !== null && r.next !== undefined)
    .sort((a, b) => a.next.aos - b.next.aos)
    .slice(0, 8);
  if (!rows.length) return <p className="text-muted">Nothing high enough to hear in the next 24 hours.</p>;
  return (
    <ul className="mt-2 divide-y divide-line">
      {rows.map(({ sat, tx, next }) => (
        <li key={sat.noradId} className="py-3">
          <div className="tabular flex items-baseline justify-between gap-2">
            <span className="font-bold">{sat.name}</span>
            <span className="text-sm">
              {next.aos <= now ? 'up now' : `${formatLocalTime(next.aos)} · ${formatCountdown(next.aos - now)}`}
            </span>
          </div>
          <div className="tabular text-sm">
            Listen on <b>{tx.downlinkHz !== null && formatMHz(tx.downlinkHz)}</b> {tx.mode} · up to {Math.round(next.maxElDeg)}°
          </div>
          <p className="!mt-1 text-sm text-muted">{whatYoullHear(tx)}</p>
        </li>
      ))}
    </ul>
  );
}

function PracticeList({
  passes,
  sats,
  station,
  now,
  onPractice,
}: {
  passes: Pass[] | null;
  sats: ReadonlyMap<number, Satellite>;
  station: Station;
  now: number;
  onPractice: (pass: Pass, sat: Satellite) => void;
}) {
  if (!passes) return <p className="text-muted">Working out passes…</p>;
  const usable = passes.filter((p) => {
    const s = sats.get(p.noradId);
    const tx = s && primaryTransmitter(s);
    return s && tx?.kind === 'fm_repeater' && isDefaultListed(s, station.experience) && p.maxElDeg >= 20;
  });
  const past = usable.filter((p) => p.los <= now).slice(-3);
  const future = usable.filter((p) => p.los > now).slice(0, 6);
  const rows = [...past, ...future];
  if (!rows.length) return <p className="text-muted">No FM passes to practise on right now.</p>;
  return (
    <ul className="mt-2 divide-y divide-line">
      {rows.map((p) => {
        const sat = sats.get(p.noradId)!;
        const tx = primaryTransmitter(sat);
        return (
          <li key={`${p.noradId}-${p.aos}`} className="tabular flex items-center gap-3 py-2">
            <div className="flex-1">
              <div className="font-bold">
                {sat.name} · {Math.round(p.maxElDeg)}°
              </div>
              <div className="text-sm text-muted">
                {p.los <= now ? 'Earlier' : formatLocalDay(p.aos)} {formatLocalTime(p.aos)}
                {tx && ` · ${formatTone(tx.ctcssHz)}`}
              </div>
            </div>
            <Button onClick={() => onPractice(p, sat)} aria-label={`Practice ${sat.name} at ${formatLocalTime(p.aos)}`}>
              Practice
            </Button>
          </li>
        );
      })}
    </ul>
  );
}
