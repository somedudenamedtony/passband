// D13: MediaRecorder on the mic (or a wired line input). Feature-detected; reports interruption
// rather than pretending a cut-short recording is whole.

import type { Clock } from '../clock';

export function canRecord(): boolean {
  return typeof window !== 'undefined' && 'MediaRecorder' in window && !!navigator.mediaDevices?.getUserMedia;
}

function pickMimeType(): string {
  for (const t of ['audio/webm;codecs=opus', 'audio/mp4', 'audio/ogg;codecs=opus', 'audio/webm']) {
    if (MediaRecorder.isTypeSupported(t)) return t;
  }
  return '';
}

export interface FinishedRecording {
  startedAt: number;
  durationMs: number;
  interrupted: boolean;
  mimeType: string;
  blob: Blob;
}

export class PassRecorder {
  private rec: MediaRecorder | null = null;
  private stream: MediaStream | null = null;
  private chunks: Blob[] = [];
  private startedAt = 0;
  private interrupted = false;
  private onHide = () => {
    if (document.visibilityState === 'hidden') this.interrupted = true;
  };

  constructor(private readonly clock: Clock) {}

  get recording(): boolean {
    return this.rec?.state === 'recording';
  }

  get wasInterrupted(): boolean {
    return this.interrupted;
  }

  async start(): Promise<void> {
    if (this.rec) return;
    this.stream = await navigator.mediaDevices.getUserMedia({
      // Radio audio: don't let the browser "clean it up".
      audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
    });
    const mimeType = pickMimeType();
    this.rec = new MediaRecorder(this.stream, mimeType ? { mimeType } : undefined);
    this.chunks = [];
    this.interrupted = false;
    this.rec.ondataavailable = (e) => {
      if (e.data.size) this.chunks.push(e.data);
    };
    this.rec.onerror = () => {
      this.interrupted = true;
    };
    this.stream.getAudioTracks().forEach((t) => {
      t.onended = () => {
        this.interrupted = true;
      };
    });
    document.addEventListener('visibilitychange', this.onHide);
    this.startedAt = this.clock.now();
    // Timeslices so a stop forced by the OS still leaves what was captured.
    this.rec.start(1000);
  }

  stop(): Promise<FinishedRecording | null> {
    const rec = this.rec;
    if (!rec) return Promise.resolve(null);
    return new Promise((resolve) => {
      rec.onstop = () => {
        document.removeEventListener('visibilitychange', this.onHide);
        this.stream?.getTracks().forEach((t) => t.stop());
        const mimeType = rec.mimeType || 'audio/webm';
        const out: FinishedRecording = {
          startedAt: this.startedAt,
          durationMs: this.clock.now() - this.startedAt,
          interrupted: this.interrupted,
          mimeType,
          blob: new Blob(this.chunks, { type: mimeType }),
        };
        this.rec = null;
        this.stream = null;
        this.chunks = [];
        resolve(out.blob.size ? out : null);
      };
      if (rec.state === 'inactive') rec.onstop?.(new Event('stop'));
      else rec.stop();
    });
  }
}
