// D14: cues are a channel with three outputs, each feature-detected. Never sniff the user agent:
// iOS simply reports no vibration, and the toggle for it is disabled.

import type { CueEvent } from '../model/cues';
import type { Station } from '../model/types';

export interface CueSupport {
  speech: boolean;
  tones: boolean;
  vibration: boolean;
}

export function cueSupport(): CueSupport {
  return {
    speech: typeof window !== 'undefined' && 'speechSynthesis' in window,
    tones: typeof window !== 'undefined' && ('AudioContext' in window || 'webkitAudioContext' in window),
    vibration: typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function',
  };
}

export interface Cue {
  emit(e: CueEvent): void;
  /** Call from a user gesture: browsers only allow audio after one (iOS especially). */
  unlock(): void;
  stop(): void;
}

let audio: AudioContext | null = null;

function audioContext(): AudioContext | null {
  if (audio) return audio;
  const Ctor =
    window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  audio = Ctor ? new Ctor() : null;
  return audio;
}

function beep(kind: CueEvent['kind']) {
  const ctx = audioContext();
  if (!ctx) return;
  // Pitches are audio tones for the cue, not radio frequencies.
  const pitches = { info: [660], retune: [880, 880], alert: [523, 784] }[kind];
  pitches.forEach((pitch, i) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.frequency.value = pitch;
    const start = ctx.currentTime + i * 0.18;
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(0.3, start + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.14);
    osc.connect(gain).connect(ctx.destination);
    osc.start(start);
    osc.stop(start + 0.15);
  });
}

const VIBRATE: Record<CueEvent['kind'], number[]> = {
  info: [120],
  retune: [80, 80, 80],
  alert: [300, 100, 300],
};

export function createCue(enabled: Station['cues']): Cue {
  const support = cueSupport();
  return {
    emit(e) {
      // An unspoken cue still needs a sound when speech is the user's only audio cue.
      if (support.tones && (enabled.tones || (enabled.speech && !e.speak))) beep(e.kind);
      if (enabled.vibration && support.vibration) navigator.vibrate(VIBRATE[e.kind]);
      if (enabled.speech && support.speech && e.speak) {
        // Retunes are time-critical: drop anything still queued rather than fall behind.
        if (e.kind !== 'info') speechSynthesis.cancel();
        const u = new SpeechSynthesisUtterance(e.text);
        u.rate = 1.05;
        speechSynthesis.speak(u);
      }
    },
    unlock() {
      if (support.tones) void audioContext()?.resume();
      if (enabled.speech && support.speech) {
        const u = new SpeechSynthesisUtterance('');
        speechSynthesis.speak(u);
      }
    },
    stop() {
      if (support.speech) speechSynthesis.cancel();
    },
  };
}
