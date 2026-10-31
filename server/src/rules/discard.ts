// Throwing items away from the bag (docs/protokol.md, Eşya atma). Pure functions.

export type DiscardRequest = { instanceId: string } | { defId: string; count: number };

/** ITEM_DISCARD body: one Float item by instanceId, or count of a stack by defId. Null if malformed. */
export function parseDiscard(body: unknown): DiscardRequest | null {
  if (typeof body !== 'object' || body === null) return null;
  const { instanceId, defId, count } = body as { instanceId?: unknown; defId?: unknown; count?: unknown };
  if (typeof instanceId === 'string' && instanceId.length > 0) {
    return instanceId.length <= 64 ? { instanceId } : null;
  }
  if (typeof defId !== 'string' || defId.length === 0 || defId.length > 64) return null;
  if (typeof count !== 'number' || !Number.isInteger(count) || count < 1 || count > 1_000_000) return null;
  return { defId, count };
}

/** Stack counts after throwing count of defId away, or the reason it cannot be done. */
export function discardFromStacks(
  stacks: { [defId: string]: number },
  defId: string,
  count: number,
): { ok: true; stacks: { [defId: string]: number } } | { ok: false; reason: 'NOT_OWNED' } {
  const have = stacks[defId] || 0;
  if (have < count) return { ok: false, reason: 'NOT_OWNED' };
  const next = { ...stacks };
  if (have === count) delete next[defId];
  else next[defId] = have - count;
  return { ok: true, stacks: next };
}
