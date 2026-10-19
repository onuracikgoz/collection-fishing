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
