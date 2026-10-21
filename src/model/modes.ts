// What a transmitter's mode means for the person holding the radio: what to set the radio to,
// and how working it goes, in plain words. No frequencies or tones here (D6): those come from
// the catalog and are shown beside this.

import type { Transmitter } from './types';

export interface ModeGuide {
  /** Short label for the mode key: "FM", "SSB / CW", "APRS". */
  label: string;
  /** What kind of thing it is: "FM voice repeater". */
  what: string;
  /** What to set the radio to. */
  setRadio: string;
  /** How using it goes, a sentence or two. */
  how: string;
  /** Can you transmit through it at all? */
  twoWay: boolean;
}

const TELEMETRY_MODES = /^(BPSK|GMSK|FSK|GFSK|AFSK|MSK|LORA|DOKA|PSK|FFSK)/i;

export function modeGuide(tx: Transmitter): ModeGuide {
  const mode = tx.mode.trim();
  const up = tx.uplinkHz !== null;
  if (/^SSTV$/i.test(mode)) {
    return {
      label: 'SSTV',
      what: 'Pictures sent as sound',
      setRadio: 'FM, listening only',
      how: 'Record the downlink audio, or hold the phone to the speaker, and decode it with an SSTV app. Each picture takes a minute or two.',
      twoWay: false,
    };
  }
  if (/^SSDV$/i.test(mode)) {
    return {
      label: 'SSDV',
      what: 'Pictures sent as data packets',
      setRadio: 'Depends on the satellite; usually a data mode into an SDR',
      how: 'Decoded with the team’s software or SatNOGS, and pieced together from packets heard by many stations.',
      twoWay: false,
    };
  }
  switch (tx.kind) {
    case 'fm_repeater':
      return {
        label: 'FM',
        what: 'FM voice repeater',
        setRadio: 'FM, with the CTCSS tone shown',
        how: 'Like a local repeater in the sky: transmit on the uplink with the tone, and you’re heard on the downlink. One conversation at a time, so keep it short: callsign and grid.',
        twoWay: up,
      };
    case 'linear_transponder':
      return {
        label: 'SSB/CW',
        what: tx.inverting ? 'Inverting linear transponder' : tx.inverting === false ? 'Linear transponder (non-inverting)' : 'Linear transponder',
        setRadio: 'USB or LSB (or CW) on both sides, full duplex',
        how: `It relays a whole slice of spectrum, so many SSB and CW contacts share it at once, each on its own frequency.${
          tx.inverting ? ' It’s inverting: tune up on the uplink and you move down on the downlink.' : ''
        } The live screen tunes both sides by one frequency for you.`,
        twoWay: up,
      };
    case 'digipeater':
      return {
        label: /APRS/i.test(mode) || /AFSK/i.test(mode) ? 'APRS' : 'Packet',
        what: 'Packet digipeater',
        setRadio: `${mode || 'Packet'} from an APRS app, TNC or a radio with packet built in`,
        how: 'You send short data bursts (a position, a message) and the satellite repeats them for everyone in view. Good for logging contacts by text.',
        twoWay: up,
      };
    default:
      break;
  }
  if (/^APRS$/i.test(mode)) {
    return { label: 'APRS', what: 'APRS', setRadio: 'APRS from an app, TNC or radio', how: 'Short data bursts repeated for everyone in view.', twoWay: up };
  }
  if (/^CW$/i.test(mode)) {
    return {
      label: 'CW',
      what: 'Morse code beacon',
      setRadio: 'CW or USB, listening only',
      how: 'The satellite keys out its callsign and telemetry in Morse. A good first thing to listen for.',
      twoWay: false,
    };
  }
  if (/^FM$/i.test(mode)) {
    return { label: 'FM', what: 'FM downlink', setRadio: 'FM, listening only', how: 'Voice or tones you can hear on any FM radio that covers the frequency.', twoWay: up };
  }
  if (TELEMETRY_MODES.test(mode)) {
    return {
      label: mode.split(/\s/)[0]!.toUpperCase(),
      what: 'Digital telemetry',
      setRadio: 'An SDR or a radio’s data output, listening only',
      how: 'Health and science data from the satellite. You hear it as buzzing; the team’s decoder or SatNOGS turns it into readings.',
      twoWay: false,
    };
  }
  return {
    label: mode || 'Unknown',
    what: mode ? `${mode} transmitter` : 'Transmitter, mode Unknown',
    setRadio: 'Unknown',
    how: 'Check the satellite’s own pages before the pass.',
    twoWay: up,
  };
}

/** What you need to work it, for someone who hasn't yet. */
export function gearFor(tx: Transmitter): string {
  switch (tx.kind) {
    case 'fm_repeater':
      return 'An FM handheld or mobile radio that covers both bands. A hand-held directional antenna makes a big difference.';
    case 'linear_transponder':
      return 'An SSB/CW radio (or two) able to transmit and receive at the same time, and a directional antenna.';
    case 'digipeater':
      return 'A radio that can send packets, or a radio plus a phone app or TNC.';
    case 'beacon':
      return 'Receive only: any radio or SDR that covers the downlink.';
    default:
      return 'Check the transmitter details before the pass.';
  }
}
