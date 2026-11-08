// Removing an item from the game completely (development only, admin_item_purge): every place a
// player's data can name the item or one of its copies. Pure functions; the RPC reads and writes.
import { BookEntries } from './book';
import { Listing } from './market';
import { ProfileDoc } from './profile';

export type Stacks = { [defId: string]: number };

/** Stacks without the purged ids; null when nothing changed. */
export function purgeStacks(stacks: Stacks, ids: string[]): Stacks | null {
  if (!ids.some((id) => id in stacks)) return null;
  const out: Stacks = {};
  for (const k in stacks) if (ids.indexOf(k) < 0) out[k] = stacks[k];
  return out;
}

/** Book records of the purged ids are forgotten (found and slot); null when nothing changed. */
export function purgeBook(entries: BookEntries, ids: string[]): BookEntries | null {
  return purgeStacks(entries as unknown as Stacks, ids) as unknown as BookEntries | null;
}

/** The profile card stops showing or hunting a purged record; null when nothing changed. */
export function purgeProfile(doc: ProfileDoc, ids: string[]): ProfileDoc | null {
  const showcase = doc.showcase.filter((id) => ids.indexOf(id) < 0);
  const hunting = doc.hunting !== undefined && ids.indexOf(doc.hunting) >= 0 ? undefined : doc.hunting;
  if (showcase.length === doc.showcase.length && hunting === doc.hunting) return null;
  const out: ProfileDoc = { showcase };
  if (hunting !== undefined) out.hunting = hunting;
  return out;
}

/** A stall without the purged stacks and copies; null when nothing changed. */
export function purgeListing<T extends Listing>(doc: T, ids: string[], instanceIds: string[]): T | null {
  const items = doc.items.filter((i) => instanceIds.indexOf(i.instanceId) < 0);
  const stacks = doc.stacks.filter((s) => ids.indexOf(s.defId) < 0);
  if (items.length === doc.items.length && stacks.length === doc.stacks.length) return null;
  return { ...doc, items, stacks };
}
