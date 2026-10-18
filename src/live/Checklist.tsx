import { useState } from 'react';
import { compassWord } from '../model/format';
import { formatTone } from '../model/freq';
import type { Pass, Transmitter } from '../model/types';

/** §5.2 pre-pass checklist. Ticks are for the user's benefit only and aren't stored. */
export function Checklist({ pass, tx }: { pass: Pass; tx: Transmitter | null }) {
  const items: string[] = [];
  if (tx?.uplinkHz != null) {
    if (tx.ctcssHz === 'unknown') items.push('Tone: unknown — check before you transmit.');
    else if (tx.ctcssHz === null) items.push('Tone: none needed. Make sure your radio isn’t sending one.');
    else items.push(`Tone set to ${formatTone(tx.ctcssHz)}.`);
  }
  items.push('Frequencies below are in your radio, or in memory channels.');
  items.push(`Antenna pointed ${compassWord(pass.aosAzDeg)}, low on the horizon.`);
  items.push('Polarisation: twist the antenna slowly until the signal is loudest.');
  if (tx?.uplinkHz != null) items.push('Listen first. Never transmit until you can hear the satellite.');
  const [done, setDone] = useState<boolean[]>(() => items.map(() => false));
  return (
    <ul className="space-y-1">
      {items.map((text, i) => (
        <li key={text}>
          <label className="flex min-h-12 items-center gap-3">
            <input
              type="checkbox"
              className="size-6 shrink-0"
              checked={done[i] ?? false}
              onChange={(e) => setDone((d) => d.map((v, j) => (j === i ? e.target.checked : v)))}
            />
            <span className={done[i] ? 'text-muted line-through' : ''}>{text}</span>
          </label>
        </li>
      ))}
    </ul>
  );
}
