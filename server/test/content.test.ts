import { describe, expect, it } from 'vitest';
import { BAIT } from '../src/config';
import { BOOK_PAGES } from '../src/data/book-pages';
import { LAKE_POOL } from '../src/data/lake-pool';
import { CHESTS, QUESTS } from '../src/data/quests';
import { RECIPES, STARTER_RECIPES } from '../src/data/recipes';
import { seedContent } from '../src/data/seed-content';
import { ContentDoc, ContentItem, checkLiveChange, compileContent, nameFromId, newItem, recipeIdFor, validateContent } from '../src/rules/content';

const clone = (d: ContentDoc): ContentDoc => JSON.parse(JSON.stringify(d));
const find = (d: ContentDoc, id: string) => d.items.filter((it) => it.id === id)[0];

describe('seed content', () => {
  const seed = seedContent();
  const rt = compileContent(seed);

  it('is valid', () => {
    expect(validateContent(seed, { waters: ['buyuk_gol'], maxLevel: 50 })).toEqual([]);
  });

  it('gives the rules exactly the placeholder lists the code had', () => {
    expect(rt.pool).toEqual(LAKE_POOL);
    expect(rt.recipes).toEqual(RECIPES);
    expect(rt.pages).toEqual(BOOK_PAGES);
    expect(rt.starter).toEqual(STARTER_RECIPES);
    expect(rt.baits).toEqual(BAIT.baits);
    expect(rt.chests).toEqual(CHESTS);
    expect(rt.quests).toEqual(QUESTS);
  });

  it('knows every item and recipe with a name and category', () => {
    expect(rt.known['lake.fish.old_turtle']).toMatchObject({ name: 'Old Turtle', category: 'legendary', type: 'item' });
    expect(rt.known['recipe.pike_trophy']).toMatchObject({ category: 'recipe', type: 'recipe' });
    expect(rt.known['bait.shiny']).toMatchObject({ category: null, type: 'bait' });
  });
});

describe('compileContent', () => {
  it('leaves drafts out of the game', () => {
    const d = clone(seedContent());
    d.items.push(newItem('glass_bottle_blue', 1, { setId: 'treasures', book: true, drop: {} }));
    const rt = compileContent(d);
    expect(rt.pool.some((x) => x.id === 'glass_bottle_blue')).toBe(false);
    expect(rt.known.glass_bottle_blue).toBeUndefined();
    expect(rt.pages.filter((p) => p.id === 'treasures')[0].items).not.toContain('glass_bottle_blue');
  });

  it('puts an approved item of a new set on a new book page', () => {
    const d = clone(seedContent());
    d.sets.push({ id: 'lost_captain', name: 'Lost Captain', active: true, order: 9, createdAt: 1 });
    d.items.push(newItem('sextant', 1, { status: 'live', tier: 'epic', setId: 'lost_captain', book: true, drop: { bands: ['deep'] } }));
    const rt = compileContent(d);
    expect(rt.pages[rt.pages.length - 1]).toEqual({ id: 'lost_captain', items: ['sextant'] });
    expect(rt.pool.filter((x) => x.id === 'sextant')[0]).toEqual({ id: 'sextant', category: 'epic', bands: ['deep'] });
  });

  it('drops inactive items and items of inactive sets, but still knows them', () => {
    const d = clone(seedContent());
    find(d, 'lake.fish.carp').active = false;
    d.sets.filter((s) => s.id === 'crafts')[0].active = false;
    const rt = compileContent(d);
    expect(rt.pool.some((x) => x.id === 'lake.fish.carp')).toBe(false);
    expect(rt.pages.some((p) => p.id === 'crafts')).toBe(false);
    expect(rt.recipes.some((r) => r.output.defId === 'craft.scale_charm')).toBe(false);
    expect(rt.known['lake.fish.carp'].active).toBe(false);
    expect(rt.known['lake.fish.carp'].category).toBe('common');
    // Chests skip what is switched off.
    expect(rt.chests[7].guaranteed).toEqual([]);
  });

  it('builds a recipe for a craftable item and passes the item weight on', () => {
    const d = clone(seedContent());
    const it = find(d, 'lake.item.old_coin');
    it.drop = { weight: 2 };
    it.recipe = { id: recipeIdFor(it.id), grade: 'good', stacks: [{ defId: 'lake.mat.scale', count: 2 }], items: [{ defId: 'lake.fish.pike', count: 1 }], drop: null, starter: 0 };
    const rt = compileContent(d);
    expect(rt.recipes.filter((r) => r.id === 'recipe.old_coin')[0]).toEqual({
      id: 'recipe.old_coin',
      grade: 'good',
      output: { defId: 'lake.item.old_coin', tier: 'rare' },
      stacks: [{ defId: 'lake.mat.scale', count: 2 }],
      items: [{ defId: 'lake.fish.pike', count: 1 }],
    });
    expect(rt.pool.filter((x) => x.id === 'lake.item.old_coin')[0].weight).toBe(2);
    expect(rt.pool.some((x) => x.id === 'recipe.old_coin')).toBe(false);
  });
});

describe('validateContent', () => {
  const bad = (edit: (d: ContentDoc) => void) => {
    const d = clone(seedContent());
    edit(d);
    return validateContent(d, { waters: ['buyuk_gol'], maxLevel: 50 });
  };

  it('needs a Tier on Float items and a set on book records', () => {
    expect(bad((d) => (find(d, 'lake.fish.carp').tier = null)).join()).toMatch(/needs a Tier/);
    expect(bad((d) => (find(d, 'lake.fish.carp').setId = null)).join()).toMatch(/needs a set/);
    expect(bad((d) => (find(d, 'lake.junk.boot').book = true)).join()).toMatch(/only items with Float/);
  });

  it('refuses unknown waters, bands, baits and sets', () => {
    expect(bad((d) => (find(d, 'lake.fish.carp').drop = { waters: ['ocean'] })).join()).toMatch(/not on the map/);
    expect(bad((d) => (find(d, 'lake.fish.carp').drop = { bands: ['sky' as never] })).join()).toMatch(/shore, mid or deep/);
    expect(bad((d) => (find(d, 'lake.fish.carp').drop = { baits: ['lake.fish.pike'] })).join()).toMatch(/not a bait item/);
    expect(bad((d) => (find(d, 'lake.fish.carp').setId = 'nope')).join()).toMatch(/does not exist/);
  });

  it('checks recipe inputs from any set', () => {
    const recipe = (stacks: { defId: string; count: number }[], items: { defId: string; count: number }[]) => (d: ContentDoc) => {
      find(d, 'lake.item.glasses').recipe = { id: 'recipe.glasses', grade: 'normal', stacks, items, drop: null, starter: 0 };
    };
    expect(bad(recipe([{ defId: 'lake.mat.scale', count: 1 }], [{ defId: 'craft.pike_trophy', count: 1 }]))).toEqual([]);
    expect(bad(recipe([{ defId: 'lake.fish.pike', count: 1 }], [])).join()).toMatch(/has Float/);
    expect(bad(recipe([], [{ defId: 'lake.mat.moss', count: 1 }])).join()).toMatch(/stacks, put it under/);
    expect(bad(recipe([], [])).join()).toMatch(/at least one input/);
    expect(bad(recipe([{ defId: 'missing', count: 1 }], [])).join()).toMatch(/does not exist/);
    expect(bad(recipe([], [{ defId: 'lake.item.glasses', count: 1 }])).join()).toMatch(/cannot use the item it makes/);
    expect(bad((d) => (find(d, 'lake.item.glasses').recipe = { ...find(d, 'craft.scale_charm').recipe! })).join()).toMatch(/already used/);
  });

  it('needs count and dust for stack outputs', () => {
    expect(bad((d) => delete find(d, 'bait.shiny').recipe!.count).join()).toMatch(/count 1-99/);
  });

  it('refuses drops on bait and Float items in chests', () => {
    expect(bad((d) => (find(d, 'bait.shiny').drop = {})).join()).toMatch(/not the water/);
    expect(bad((d) => d.chests[0].pool.push({ weight: 1, defId: 'lake.fish.pike', count: 1 })).join()).toMatch(/stacks only/);
  });
});

describe('checkLiveChange', () => {
  const base = (): ContentItem => JSON.parse(JSON.stringify(find(seedContent(), 'craft.scale_charm')));

  it('allows names, Tier, drops and sets to change', () => {
    const after = { ...base(), name: 'Scale Charm', tier: 'rare' as const, setId: 'treasures' };
    expect(checkLiveChange(base(), after)).toEqual([]);
  });

  it('refuses changes that break owned copies', () => {
    expect(checkLiveChange(base(), { ...base(), type: 'material' }).join()).toMatch(/Float item and stack/);
    expect(checkLiveChange(base(), { ...base(), recipe: null }).join()).toMatch(/keep the recipe/);
    expect(checkLiveChange(base(), { ...base(), status: 'draft' }).join()).toMatch(/back to draft/);
  });

  it('lets drafts change freely', () => {
    const d = { ...base(), status: 'draft' as const };
    expect(checkLiveChange(d, { ...d, type: 'material', recipe: null })).toEqual([]);
  });
});

describe('names', () => {
  it('turns ids into names', () => {
    expect(nameFromId('glass_bottle_blue')).toBe('Glass Bottle Blue');
    expect(nameFromId('lake.fish.old_turtle')).toBe('Old Turtle');
    expect(recipeIdFor('craft.scale_charm')).toBe('recipe.scale_charm');
  });
});
