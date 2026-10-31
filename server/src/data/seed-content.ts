// The content a fresh server starts with, built from the placeholder lists in this folder
// (lake-pool, recipes, book-pages, quests) and config (catch table, baits). Once the admin panel
// saves, the stored ContentDoc wins and this is only the fallback (match/content.ts).
import { BAIT, CATCH_TABLE } from '../config';
import { tierOf } from '../rules/catch';
import { isStackOutput } from '../rules/craft';
import { CONTENT_FORMAT, ContentDoc, ContentItem, ContentSet, DropDef, ItemType, RecipeSpec, nameFromId } from '../rules/content';
import { BOOK_PAGES } from './book-pages';
import { LAKE_POOL } from './lake-pool';
import { CHESTS, QUESTS } from './quests';
import { RECIPES, STARTER_RECIPES } from './recipes';

const SET_NAMES: { [id: string]: string } = { lake_fish: 'Lake Fish', deep_water: 'Deep Water', treasures: 'Treasures', crafts: 'Crafts' };

function dropOf(id: string): DropDef | null {
  const d = LAKE_POOL.filter((x) => x.id === id)[0];
  if (!d) return null;
  const out: DropDef = {};
  if (d.waters) out.waters = d.waters.slice();
  if (d.bands) out.bands = d.bands.slice();
  if (d.baits) out.baits = d.baits.slice();
  if (d.minLevel) out.minLevel = d.minLevel;
  if (d.weight !== undefined) out.weight = d.weight;
  return out;
}

function placeOf(id: string): { setId: string | null; order: number } {
  for (const p of BOOK_PAGES) {
    const i = p.items.indexOf(id);
    if (i >= 0) return { setId: p.id, order: i };
  }
  return { setId: null, order: 0 };
}

function recipeFor(defId: string): RecipeSpec | null {
  const r = RECIPES.filter((x) => x.output.defId === defId)[0];
  if (!r) return null;
  const starter = STARTER_RECIPES.filter((s) => s.defId === r.id)[0];
  const spec: RecipeSpec = {
    id: r.id,
    grade: r.grade,
    stacks: r.stacks.map((s) => ({ ...s })),
    items: r.items.map((s) => ({ ...s })),
    drop: dropOf(r.id),
    starter: starter ? starter.count : 0,
  };
  if (isStackOutput(r.output)) {
    spec.count = r.output.count;
    spec.dust = r.dust || 0;
  }
  return spec;
}

function item(id: string, type: ItemType, over: Partial<ContentItem>): ContentItem {
  const place = placeOf(id);
  return {
    id,
    name: nameFromId(id),
    type,
    tier: null,
    book: place.setId !== null,
    setId: place.setId,
    active: true,
    status: 'live',
    order: place.order,
    art: null,
    drop: dropOf(id),
    recipe: recipeFor(id),
    updatedAt: 0,
    ...over,
  };
}

export function seedContent(): ContentDoc {
  const items: ContentItem[] = [];
  for (const d of LAKE_POOL) {
    if (d.category === 'recipe') continue;
    const tier = tierOf(d.category);
    items.push(item(d.id, tier ? 'item' : (d.category as ItemType), { tier }));
  }
  for (const r of RECIPES) {
    const o = r.output;
    if (isStackOutput(o) || items.some((it) => it.id === o.defId)) continue;
    items.push(item(o.defId, 'item', { tier: o.tier }));
  }
  for (const id in BAIT.baits) items.push(item(id, 'bait', { bait: JSON.parse(JSON.stringify(BAIT.baits[id])), drop: null }));

  const sets: ContentSet[] = BOOK_PAGES.map((p, i) => ({ id: p.id, name: SET_NAMES[p.id] || nameFromId(p.id), active: true, order: i, createdAt: 0 }));
  return {
    format: CONTENT_FORMAT,
    items,
    sets,
    catchTable: { ...CATCH_TABLE },
    chests: JSON.parse(JSON.stringify(CHESTS)),
    quests: JSON.parse(JSON.stringify(QUESTS)),
    updatedAt: 0,
  };
}
