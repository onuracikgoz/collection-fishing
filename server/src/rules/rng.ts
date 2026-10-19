// Seeded random numbers. mulberry32 is used by the reel mini game, which the
// client must replay exactly, so keep it bit-for-bit as documented in docs/protokol.md.

/** Returns a generator of unsigned 32-bit integers. */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return function next(): number {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return (t ^ (t >>> 14)) >>> 0;
  };
}

/** A source of uniform numbers in [0, 1). Math.random in the match, seeded in tests. */
export type Random = () => number;

export function seededRandom(seed: number): Random {
  const next = mulberry32(seed);
  return () => next() / 4294967296;
}

/** Picks a key by integer weight. Weights of 0 never win. */
export function pickWeighted<K extends string>(weights: { [key in K]?: number }, random: Random): K | null {
  let total = 0;
  for (const k in weights) total += Math.max(0, weights[k] || 0);
  if (total <= 0) return null;
  let roll = random() * total;
  for (const k in weights) {
    const w = Math.max(0, weights[k] || 0);
    if (roll < w) return k;
    roll -= w;
  }
  return null;
}
