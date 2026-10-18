// The synthetic downlink for practice mode (D16). Web Audio only; feature-detected by the caller.

import { toneMix } from '../model/practice';

const TONE_PITCH = 700; // audio Hz, the "voice" on the downlink — not a radio frequency

export class PracticeTone {
  private ctx: AudioContext | null = null;
  private toneGain: GainNode | null = null;
  private noiseGain: GainNode | null = null;
  private sources: AudioScheduledSourceNode[] = [];

  static supported(): boolean {
    return typeof window !== 'undefined' && ('AudioContext' in window || 'webkitAudioContext' in window);
  }

  /** Must be called from a user gesture. */
  start(): void {
    if (this.ctx) return;
    const Ctor =
      window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return;
    const ctx = new Ctor();
    const master = ctx.createGain();
    master.gain.value = 0.25;
    master.connect(ctx.destination);

    const osc = ctx.createOscillator();
    osc.frequency.value = TONE_PITCH;
    // A slow warble so it sounds like something being said, not a test tone.
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 3;
    const lfoDepth = ctx.createGain();
    lfoDepth.gain.value = 25;
    lfo.connect(lfoDepth).connect(osc.frequency);
    this.toneGain = ctx.createGain();
    osc.connect(this.toneGain).connect(master);

    const buf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    const noise = ctx.createBufferSource();
    noise.buffer = buf;
    noise.loop = true;
    this.noiseGain = ctx.createGain();
    noise.connect(this.noiseGain).connect(master);

    this.toneGain.gain.value = 0;
    this.noiseGain.gain.value = 0;
    osc.start();
    lfo.start();
    noise.start();
    this.sources = [osc, lfo, noise];
    this.ctx = ctx;
  }

  /** errorHz: dial minus where the signal is. null = satellite below the horizon (silence). */
  update(errorHz: number | null): void {
    if (!this.ctx || !this.toneGain || !this.noiseGain) return;
    const now = this.ctx.currentTime;
    const mix = errorHz === null ? { tone: 0, noise: 0 } : toneMix(errorHz);
    this.toneGain.gain.setTargetAtTime(mix.tone, now, 0.05);
    this.noiseGain.gain.setTargetAtTime(mix.noise * 0.6, now, 0.05);
  }

  stop(): void {
    this.sources.forEach((s) => s.stop());
    this.sources = [];
    void this.ctx?.close();
    this.ctx = null;
  }
}
