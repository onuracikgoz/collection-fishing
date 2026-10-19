// Recipes for Faz 4. Placeholder ids until the real sets (content/sets/) exist;
// only the mechanics depend on this shape (docs/tasarim/08-recipe-craft.md).
import { RecipeDef } from '../rules/craft';

export const RECIPES: RecipeDef[] = [
  {
    id: 'recipe.scale_charm',
    grade: 'normal',
    output: { defId: 'craft.scale_charm', tier: 'common' },
    stacks: [{ defId: 'lake.mat.scale', count: 3 }, { defId: 'lake.mat.moss', count: 1 }],
    items: [],
  },
  {
    id: 'recipe.moss_wreath',
    grade: 'normal',
    output: { defId: 'craft.moss_wreath', tier: 'common' },
    stacks: [{ defId: 'lake.mat.moss', count: 3 }],
    items: [],
  },
  {
    // An "upper" recipe: one crafted item and one fish go in (11.1).
    id: 'recipe.pike_trophy',
    grade: 'good',
    output: { defId: 'craft.pike_trophy', tier: 'rare' },
    stacks: [{ defId: 'lake.mat.scale', count: 2 }],
    items: [{ defId: 'craft.scale_charm', count: 1 }, { defId: 'lake.fish.pike', count: 1 }],
  },
  {
    // Special bait can be crafted too (16-ekonomi-tablosu.md 4.1). Dust is per recipe: bait has no Tier.
    id: 'recipe.shiny_bait',
    grade: 'normal',
    output: { defId: 'bait.shiny', count: 5 },
    dust: 10, // (Öneri) 5 baits cost 25 Coin at the shop
    stacks: [{ defId: 'lake.mat.scale', count: 2 }, { defId: 'lake.junk.shell', count: 1 }],
    items: [],
  },
];

/** Given once to every new account, so crafting can be learned right away (10.2). */
export const STARTER_RECIPES: { defId: string; count: number }[] = [
  { defId: 'recipe.scale_charm', count: 1 },
  { defId: 'recipe.moss_wreath', count: 1 },
];

export function recipeById(id: string): RecipeDef | null {
  for (const r of RECIPES) if (r.id === id) return r;
  return null;
}
