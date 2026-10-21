import { formatMHz, formatTone } from '../model/freq';
import { whatYoullHear } from '../model/listen';
import { gearFor, modeGuide } from '../model/modes';
import type { Transmitter } from '../model/types';
import { Fold } from './common';

/** Small answers beside the controls they explain; available with tips on or off. */
export function OperatingHelp({ tx, listenOnly = false, troubleshoot = false }: {
  tx: Transmitter; listenOnly?: boolean; troubleshoot?: boolean;
}) {
  return (
    <div className="operating-help">
      <Fold title="What should I hear?">
        <p>{whatYoullHear(tx)}</p>
        <p className="hint">{gearFor(tx)}</p>
        <p>{modeGuide(tx).how}</p>
      </Fold>
      {!listenOnly && tx.kind === 'fm_repeater' && tx.uplinkHz !== null && (
        <Fold title="What does the tone setting mean?">
          <p>A transmit CTCSS tone tells the repeater to accept your signal. It is separate from the radio’s tuning frequency.</p>
          <p>{tx.ctcssHz === 'unknown' ? 'The required tone is unknown. Check the satellite’s published instructions before transmitting.'
            : tx.ctcssHz === null ? 'No transmit tone is needed for this transmitter.' : `Set the transmit tone to ${formatTone(tx.ctcssHz)}. The tone is sent by your radio; it is not a sound you need to make.`}</p>
        </Fold>
      )}
      <Fold title="I hear nothing" open={troubleshoot}>
        <ol className="help-steps">
          <li>Check the pass time and location. Before rise or after set, the satellite is below the horizon.</li>
          <li>Check the satellite’s operating outlook and orbit-data age. It may be switched off or the prediction may be approximate.</li>
          <li>{tx.downlinkHz === null ? 'The downlink frequency is unknown. Check the satellite profile.' : `Use the listen frequency shown for this moment; the catalog frequency (${formatMHz(tx.downlinkHz)} MHz) may need Doppler correction.`} Set the receive mode for this transmitter.</li>
          <li>Check the antenna connection and open the squelch. Aim toward the predicted position, then rotate the antenna slowly to find the strongest signal.</li>
          <li>{tx.kind === 'linear_transponder' ? 'Use an SSB / CW receiver and tune within the passband. An FM-only handheld cannot receive SSB conversations.'
            : tx.kind === 'digipeater' || tx.kind === 'other' || (tx.kind === 'beacon' && !/^(FM|CW)$/i.test(tx.mode))
              ? 'Data signals can sound like short buzzing bursts. Decoding may need an SDR, a data interface and suitable software.'
              : 'Listen across the usable part of the pass. A quiet repeater may have no other stations using it.'}</li>
        </ol>
        {!listenOnly && <p>Keep listening until you can hear the downlink before attempting to transmit.</p>}
        <p className="hint">Try another high pass with recent heard reports. Hearing and identifying a satellite is a useful first success.</p>
      </Fold>
    </div>
  );
}
