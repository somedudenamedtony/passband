// §5.5: the first-contact guide, things to hear tonight, and practice (D16).
// D19: open by default for new operators; folded away under Help for experienced ones.

import { useMemo, type ReactNode } from 'react';
import {
  IonAccordion,
  IonAccordionGroup,
  IonButton,
  IonCard,
  IonCardContent,
  IonItem,
  IonLabel,
  IonList,
  IonNote,
} from '@ionic/react';
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

  // D19: the guide starts open for new operators and folded away for experienced ones.
  const open = isNew ? ['first', 'listen', 'practice'] : ['listen'];

  return (
    <IonAccordionGroup multiple value={open}>
      <Section value="first" title="Your first contact">
        <h3>1. Gear</h3>
        <ul>
          <li>A dual-band FM radio that can transmit on one band while listening on the other. A common handheld works.</li>
          <li>A small hand-held directional antenna for 2 m and 70 cm. The rubber duck that came with the radio rarely works.</li>
          <li>Earphones, so the downlink doesn’t feed back into your microphone.</li>
          <li>The frequencies and tone programmed into memory channels before the pass. The live screen lists them.</li>
        </ul>

        <h3>2. Pick a pass</h3>
        <p>Start with an easy FM satellite on a high pass: it’s up for longer, louder, and easier to point at.</p>
        {passes === null ? (
          <IonNote>Working out passes…</IonNote>
        ) : easiest && easiestSat ? (
          <IonCard style={{ margin: '8px 0' }}>
            <IonCardContent>
              <p style={{ fontWeight: 600, color: 'var(--fg)' }}>
                {easiestSat.name}, {formatLocalDay(easiest.aos)} {formatLocalTime(easiest.aos)} ({formatCountdown(easiest.aos - now)}), up
                to {Math.round(easiest.maxElDeg)}°, rising in the {compassWord(easiest.aosAzDeg)}.
              </p>
              <Button kind="primary" className="ion-margin-top" onClick={() => onPick(easiest)}>
                Use this pass
              </Button>
            </IonCardContent>
          </IonCard>
        ) : (
          <IonNote>No easy pass in the next 24 hours from {location.name}.</IonNote>
        )}

        <h3>3. Listen first</h3>
        <p>
          When the satellite rises, listen. You should hear other stations before you say anything. If you can’t hear the
          satellite, nobody can hear you through it — <b>never transmit until you hear the downlink.</b>
        </p>

        <h3>4. What to say</h3>
        <p>Wait for a gap, then give your callsign and grid square, once:</p>
        <Script>
          {callsign(station)}, {grid4(location.grid6)}
        </Script>
        <p>If someone answers with their call and grid, reply with theirs and yours, then let others in:</p>
        <Script>
          K1ABC, {callsign(station)}, thanks, {grid4(location.grid6)}
        </Script>
        <IonNote>
          K1ABC stands in for whoever answers.{!station.callsign && ' Set your own callsign in Settings.'}
        </IonNote>

        <h3>5. Etiquette</h3>
        <ul>
          <li>Listen before you transmit, every time.</li>
          <li>Callsign and grid, nothing more. A pass lasts ten minutes and everyone wants a turn.</li>
          <li>Don’t call over someone. Wait for a gap.</li>
          <li>One contact per pass is plenty on a busy FM satellite.</li>
          <li>Retune as the satellite moves; the live screen tells you when.</li>
        </ul>

        <h3>6. What success sounds like</h3>
        <p>
          You key up, give your call, and a moment later hear your own voice come back from the satellite, a little
          delayed. Then someone says your callsign. That’s a contact — log their call, their grid and the time.
        </p>
      </Section>

      <Section value="listen" title="Listen tonight">
        <IonNote>No licence needed to listen. Any radio or SDR that covers the frequency will do.</IonNote>
        <ListenList sats={sats} passes={passes} now={now} />
      </Section>

      <Section value="practice" title="Practice a pass">
        <p>
          Run a real pass — one coming up or one from earlier today — through the live screen on a simulated clock, at
          normal speed or faster. A practice tone stands in for the satellite so you can learn to retune by ear.
        </p>
        <PracticeList passes={passes} sats={byId} station={station} now={now} onPractice={onPractice} />
      </Section>
    </IonAccordionGroup>
  );
}

function callsign(station: Station): string {
  return station.callsign || 'W7LIT';
}

function Section({ value, title, children }: { value: string; title: string; children: ReactNode }) {
  return (
    <IonAccordion value={value}>
      <IonItem slot="header">
        <IonLabel style={{ fontWeight: 700, fontSize: '1.1rem' }}>{title}</IonLabel>
      </IonItem>
      <div slot="content" className="ion-padding learn-body">
        {children}
      </div>
    </IonAccordion>
  );
}

function Script({ children }: { children: ReactNode }) {
  return <p className="script-line">“{children}”</p>;
}

function ListenList({ sats, passes, now }: { sats: Satellite[]; passes: Pass[] | null; now: number }) {
  if (!passes) return <IonNote>Working out passes…</IonNote>;
  const rows = sats
    .map((s) => ({ sat: s, tx: listeningTransmitter(s), next: passes.find((p) => p.noradId === s.noradId && p.los > now && p.maxElDeg >= 15) }))
    .filter((r): r is { sat: Satellite; tx: NonNullable<typeof r.tx>; next: Pass } => r.tx !== null && r.next !== undefined)
    .sort((a, b) => a.next.aos - b.next.aos)
    .slice(0, 8);
  if (!rows.length) return <IonNote>Nothing high enough to hear in the next 24 hours.</IonNote>;
  return (
    <IonList lines="full">
      {rows.map(({ sat, tx, next }) => (
        <IonItem key={sat.noradId}>
          <IonLabel className="tabular" style={{ whiteSpace: 'normal' }}>
            <h2 style={{ fontWeight: 700 }}>{sat.name}</h2>
            <h3>
              Listen on <b>{tx.downlinkHz !== null && formatMHz(tx.downlinkHz)}</b> {tx.mode} · up to {Math.round(next.maxElDeg)}°
            </h3>
            <p>{whatYoullHear(tx)}</p>
          </IonLabel>
          <IonNote slot="end" className="tabular">
            {next.aos <= now ? 'up now' : formatLocalTime(next.aos)}
          </IonNote>
        </IonItem>
      ))}
    </IonList>
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
  if (!passes) return <IonNote>Working out passes…</IonNote>;
  const usable = passes.filter((p) => {
    const s = sats.get(p.noradId);
    const tx = s && primaryTransmitter(s);
    return s && tx?.kind === 'fm_repeater' && isDefaultListed(s, station.experience) && p.maxElDeg >= 20;
  });
  const past = usable.filter((p) => p.los <= now).slice(-3);
  const future = usable.filter((p) => p.los > now).slice(0, 6);
  const rows = [...past, ...future];
  if (!rows.length) return <IonNote>No FM passes to practise on right now.</IonNote>;
  return (
    <IonList lines="full">
      {rows.map((p) => {
        const sat = sats.get(p.noradId)!;
        const tx = primaryTransmitter(sat);
        return (
          <IonItem key={`${p.noradId}-${p.aos}`}>
            <IonLabel className="tabular">
              <h2 style={{ fontWeight: 700 }}>
                {sat.name} · {Math.round(p.maxElDeg)}°
              </h2>
              <p>
                {p.los <= now ? 'Earlier' : formatLocalDay(p.aos)} {formatLocalTime(p.aos)}
                {tx && ` · ${formatTone(tx.ctcssHz)}`}
              </p>
            </IonLabel>
            <IonButton slot="end" fill="outline" onClick={() => onPractice(p, sat)} aria-label={`Practice ${sat.name} at ${formatLocalTime(p.aos)}`}>
              Practice
            </IonButton>
          </IonItem>
        );
      })}
    </IonList>
  );
}
