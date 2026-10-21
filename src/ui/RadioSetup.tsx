// A transmitter as you'd set it on the radio: the mode, what to listen on, what to transmit on,
// the tone, and the band each is in. One layout for the pass card and the info sheet, so the
// words and the order never change between screens. Lives inside an .lcd.

import { useId, useState } from 'react';
import { adifBand } from '../model/bands';
import { formatMHz, formatTone } from '../model/freq';
import { modeGuide } from '../model/modes';
import type { Transmitter } from '../model/types';
import { Icon } from './icons';

export interface Tuning {
  downlinkHz: number | null;
  uplinkHz: number | null;
  /** Which side to retune through the pass; the other stays put. */
  tuneSide: 'uplink' | 'downlink' | null;
  /** "at rise" before the pass, "now" during it. */
  when: string;
}

function band(hz: number | null): string | null {
  const b = hz === null ? null : adifBand(hz);
  return b ? b.replace(/(\d)(c?m)$/, '$1 $2') : null;
}

function range(lo: number | null, hi: number | null): string | null {
  if (lo === null) return null;
  return hi !== null && hi !== lo ? `${formatMHz(lo)}–${formatMHz(hi)}` : formatMHz(lo);
}

export function RadioSetup({
  tx,
  tuning,
  size = 'large',
  isNew = false,
}: {
  tx: Transmitter;
  /** Doppler-corrected FM frequencies; without it the catalog's nominal ones are shown. */
  tuning?: Tuning | null;
  size?: 'large' | 'small';
  isNew?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const id = useId();
  const guide = modeGuide(tx);
  const linear = tx.kind === 'linear_transponder';
  const down = linear ? range(tx.downlinkHz, tx.downlinkHighHz) : (tuning?.downlinkHz ?? tx.downlinkHz) === null ? null : formatMHz((tuning?.downlinkHz ?? tx.downlinkHz)!);
  const up = linear ? range(tx.uplinkHz, tx.uplinkHighHz) : (tuning?.uplinkHz ?? tx.uplinkHz) === null ? null : formatMHz((tuning?.uplinkHz ?? tx.uplinkHz)!);
  const readout = size === 'large' && !linear ? 'readout readout-l' : 'readout readout-s';
  const when = (side: 'uplink' | 'downlink') => (tuning?.tuneSide === side ? ` ${tuning.when}` : '');

  return (
    <div className="radio-setup">
      <div className="lcd-line">
        <button type="button" className="mode-key" aria-expanded={open} aria-controls={id} onClick={() => setOpen((o) => !o)}>
          {guide.label}
          <Icon name="info" size={14} />
        </button>
        <span className="lcd-label" style={{ textAlign: 'right' }}>
          {guide.what}
          {!guide.twoWay && ' · listen only'}
        </span>
      </div>
      {open && (
        <div id={id} className="mode-guide">
          <p>
            <span className="lcd-label">Set the radio to </span>
            {guide.setRadio}.
          </p>
          <p>{guide.how}</p>
        </div>
      )}

      {down && (
        <div className="lcd-line freq-line">
          <span className="lcd-label">
            ↓ Listen{when('downlink')}
            {band(tx.downlinkHz) && <span className="band">{band(tx.downlinkHz)}</span>}
          </span>
          <span className={readout}>{down}</span>
        </div>
      )}
      {up && (
        <div className="lcd-line freq-line">
          <span className="lcd-label">
            ↑ Transmit{when('uplink')}
            {band(tx.uplinkHz) && <span className="band">{band(tx.uplinkHz)}</span>}
          </span>
          <span className={readout}>{up}</span>
        </div>
      )}
      {tx.uplinkHz !== null && tx.kind === 'fm_repeater' && (
        <div className="lcd-line freq-line">
          <span className="lcd-label">Tone</span>
          <span className="readout readout-s" style={{ fontStyle: tx.ctcssHz === 'unknown' ? 'italic' : undefined }}>
            {formatTone(tx.ctcssHz)}
          </span>
        </div>
      )}
      {linear && <p className="lcd-note">These are the passband edges. The live screen gives you one frequency to tune.</p>}
      {isNew && tuning?.tuneSide && (
        <p className="lcd-note">
          Leave the {tuning.tuneSide === 'downlink' ? 'transmit' : 'listen'} frequency alone and retune the{' '}
          {tuning.tuneSide === 'downlink' ? 'listen' : 'transmit'} side as the satellite passes.
        </p>
      )}
    </div>
  );
}
