import { describe, expect, it } from 'vitest';
import { purgeBook, purgeListing, purgeProfile, purgeStacks } from '../src/rules/purge';

describe('purge rules', () => {
  const ids = ['image', 'recipe.image'];

  it('drops the item and its recipe from stacks', () => {
    expect(purgeStacks({ image: 2, 'recipe.image': 1, bait: 3 }, ids)).toEqual({ bait: 3 });
    expect(purgeStacks({ bait: 3 }, ids)).toBeNull();
  });

  it('forgets the book record', () => {
    expect(purgeBook({ image: { foundAt: 1, slot: { instanceId: 'a' } as any }, carp: { foundAt: 2 } }, ids)).toEqual({ carp: { foundAt: 2 } });
    expect(purgeBook({ carp: { foundAt: 2 } }, ids)).toBeNull();
  });

  it('clears the profile showcase and hunting', () => {
    expect(purgeProfile({ showcase: ['carp', 'image'], hunting: 'image' }, ids)).toEqual({ showcase: ['carp'] });
    expect(purgeProfile({ showcase: ['carp'], hunting: 'pike' }, ids)).toBeNull();
  });

  it('takes copies and stacks off a stall', () => {
    const stall = { title: 't', items: [{ instanceId: 'a', price: 5 }, { instanceId: 'b', price: 6 }], stacks: [{ defId: 'image', count: 1, price: 2 }, { defId: 'bait', count: 1, price: 1 }] };
    expect(purgeListing(stall, ids, ['a'])).toEqual({ title: 't', items: [{ instanceId: 'b', price: 6 }], stacks: [{ defId: 'bait', count: 1, price: 1 }] });
    expect(purgeListing(stall, ids, ['z'])).toMatchObject({ items: stall.items });
    expect(purgeListing({ ...stall, stacks: [] }, ids, [])).toBeNull();
  });
});
