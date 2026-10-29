// Item lock (docs/tasarim/07-kopya-envanter.md 9.3, docs/protokol.md Eşya kilidi). Pure functions.

/** ITEM_LOCK body, or null if it is malformed. */
export function parseLock(body: unknown): { instanceId: string; locked: boolean } | null {
  if (typeof body !== 'object' || body === null) return null;
  const { instanceId, locked } = body as { instanceId?: unknown; locked?: unknown };
  if (typeof instanceId !== 'string' || instanceId.length === 0 || instanceId.length > 64) return null;
  if (typeof locked !== 'boolean') return null;
  return { instanceId, locked };
}

/** True if any of these stored items is locked. */
export function anyLocked(items: { locked?: boolean }[]): boolean {
  return items.some((i) => i.locked === true);
}
