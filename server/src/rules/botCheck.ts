// Bot signals (docs/tasarim/03-balik-tutma.md 5.1.1): flags for moderators, never an automatic ban.
// Pure functions, no Nakama dependency.

export interface BotCheckConfig {
  /** Hook reaction times kept per player (the newest ones). */
  hookSamples: number;
  /** A full sample set with a spread below this (ms, standard deviation) looks machine-made. */
  hookMaxStdevMs: number;
  /** Gap between casts that still counts as one fishing session. */
  activeGapMs: number;
  /** Fishing time in one day above this gets flagged ("7/24"). */
  maxDailyActiveMs: number;
  /** The day starts at 00:00 in this offset from UTC (Turkey: +3 h). */
  dayOffsetMs: number;
}

export type BotFlag = 'regular_hook' | 'long_hours';

/** Adds a sample and keeps only the newest `max`. */
export function pushSample(samples: number[], value: number, max: number): number[] {
  const out = samples.concat([value]);
  return out.length > max ? out.slice(out.length - max) : out;
}

export function stdev(xs: number[]): number {
  if (xs.length === 0) return 0;
  const mean = xs.reduce((a, b) => a + b, 0) / xs.length;
  return Math.sqrt(xs.reduce((a, b) => a + (b - mean) * (b - mean), 0) / xs.length);
}

/** True when a full set of hook reaction times is too even for a person. */
export function hookTooRegular(samples: number[], cfg: BotCheckConfig): boolean {
  return samples.length >= cfg.hookSamples && stdev(samples) < cfg.hookMaxStdevMs;
}

export interface ActivityDoc {
  day: number;
  /** Fishing time counted today. */
  ms: number;
}

export const dayNumber = (now: number, cfg: BotCheckConfig): number => Math.floor((now + cfg.dayOffsetMs) / 86400000);

/**
 * Counts the time since the previous cast as fishing if it is shorter than the gap. A new day starts
 * from zero. Returns the new doc.
 */
export function addActive(doc: ActivityDoc | null, lastCastAt: number | undefined, now: number, cfg: BotCheckConfig): ActivityDoc {
  const day = dayNumber(now, cfg);
  const base = doc && doc.day === day ? doc.ms : 0;
  const step = lastCastAt !== undefined && now - lastCastAt > 0 && now - lastCastAt <= cfg.activeGapMs ? now - lastCastAt : 0;
  return { day, ms: base + step };
}

export const tooLong = (doc: ActivityDoc, cfg: BotCheckConfig): boolean => doc.ms > cfg.maxDailyActiveMs;

export function normalizeActivity(v: unknown): ActivityDoc | null {
  if (typeof v !== 'object' || v === null) return null;
  const { day, ms } = v as { day?: unknown; ms?: unknown };
  return typeof day === 'number' && typeof ms === 'number' && ms >= 0 ? { day, ms } : null;
}
