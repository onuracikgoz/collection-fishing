// Bag slots (docs/tasarim/07-kopya-envanter.md 9.3). Pure functions, no Nakama dependency.

export interface BagConfig {
  slots: number;
  stackSize: number;
}

export interface BagSummary {
  /** Item instances (Float items), one slot each. */
  items: number;
  /** Stackable items by definition id. */
  stacks: { [defId: string]: number };
}

export function slotsUsed(bag: BagSummary, cfg: BagConfig): number {
  let used = bag.items;
  for (const id in bag.stacks) used += Math.ceil(bag.stacks[id] / cfg.stackSize);
  return used;
}

/** True if one more of this thing fits. Pass null defId for an item instance. */
export function canAdd(bag: BagSummary, defId: string | null, cfg: BagConfig): boolean {
  if (defId !== null) {
    const count = bag.stacks[defId] || 0;
    if (count > 0 && count % cfg.stackSize !== 0) return true;
  }
  return slotsUsed(bag, cfg) < cfg.slots;
}

/** True if there is at least one free slot, so any catch fits. */
export function hasFreeSlot(bag: BagSummary, cfg: BagConfig): boolean {
  return slotsUsed(bag, cfg) < cfg.slots;
}
