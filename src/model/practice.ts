// D16: practice mode stands a synthetic tone in for the downlink, so retuning is learnt by ear.

/** Off by this much or less, FM sounds clean. */
const CLEAN_HZ = 1500;
/** Off by this much more than clean, it's all noise. */
const FADE_HZ = 6000;

/**
 * How the practice tone sounds when the dial is `errorHz` away from where the signal really is:
 * a clean tone that drowns in noise as the error grows, the way a mistuned FM downlink does.
 */
export function toneMix(errorHz: number): { tone: number; noise: number } {
  const f = Math.min(1, Math.max(0, (Math.abs(errorHz) - CLEAN_HZ) / FADE_HZ));
  return { tone: 1 - f, noise: f };
}

export type TuningVerdict = 'on' | 'close' | 'off';

export function tuningVerdict(errorHz: number): TuningVerdict {
  const e = Math.abs(errorHz);
  if (e <= CLEAN_HZ) return 'on';
  if (e <= CLEAN_HZ + FADE_HZ / 2) return 'close';
  return 'off';
}

export const PRACTICE_RATES = [1, 2, 4] as const;
export type PracticeRate = (typeof PRACTICE_RATES)[number];
