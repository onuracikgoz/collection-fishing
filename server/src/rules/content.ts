// Game content as data: items, sets, recipes, book pages, the catch table, chests and quests
// (docs/tasarim/19-icerik-yonetimi.md). The admin panel edits one ContentDoc; the server turns it
// into the lists the rules already take (pool, recipes, pages...). Pure functions, no Nakama dependency.
import { BaitDef } from './bait';
import { CatchTable, Category, ItemDef, Tier } from './catch';
import { RecipeDef, RecipeGrade } from './craft';
import { BookPage } from './book';
import { ChestDef, QuestDef, QuestEvent } from './quest';
import { BANDS, Band } from './water';

export const CONTENT_FORMAT = 'content/1';

/**
 * item: one Float copy per catch, has a Tier, can be a book record.
 * fish (ordinary fish), junk, material, bait: stack in the bag, no Float.
 */
export type ItemType = 'item' | 'fish' | 'junk' | 'material' | 'bait';
export const ITEM_TYPES: ItemType[] = ['item', 'fish', 'junk', 'material', 'bait'];
export const TIERS: Tier[] = ['common', 'rare', 'epic', 'legendary', 'mythic'];
export const GRADES: RecipeGrade[] = ['normal', 'good', 'master'];
export const CATEGORIES: Category[] = ['junk', 'fish', 'common', 'material', 'rare', 'epic', 'recipe', 'legendary', 'mythic'];
const QUEST_EVENTS: QuestEvent[] = ['catch', 'catch_tier', 'sell', 'craft', 'merge', 'trade', 'emote'];

/** Where it comes out of the water (03-balik-tutma.md "Eşyanın çıkış alanları"). A missing field means no limit. */
export interface DropDef {
  waters?: string[];
  bands?: Band[];
  /** Special baits that make it come up more often inside its category. */
  baits?: string[];
  minLevel?: number;
  /** Weight inside its category, 1 if missing. */
  weight?: number;
}

export interface Stack {
  defId: string;
  count: number;
}

/** A craftable item's recipe. The recipe is a stack item of its own ("şişedeki recipe", 08-recipe-craft.md). */
export interface RecipeSpec {
  /** The recipe item's id; set once when the item becomes craftable, never renamed. */
  id: string;
  grade: RecipeGrade;
  /** Stack inputs (fish, junk, materials, bait), from any set. */
  stacks: Stack[];
  /** Float item inputs (type item), from any set. */
  items: Stack[];
  /** Stack outputs only (bait, materials): how many one craft makes. */
  count?: number;
  /** Stack outputs only: dust per craft (an item output's dust comes from its Tier). */
  dust?: number;
  /** Where the recipe itself comes out of the water; null = never (chests or starter only). */
  drop: DropDef | null;
  /** Given to every new account. */
  starter: number;
}

export interface ArtRef {
  /** sha256 of the PNG bytes (base64 text); the client caches by it. */
  hash: string;
  w: number;
  h: number;
}

export interface ContentItem {
  id: string;
  /** English for now; translations come later. */
  name: string;
  type: ItemType;
  /** Required for type item; for stacks only shown (sorting, colour). */
  tier: Tier | null;
  /** A Collection Book record (type item only). Needs a set: the set is its page. */
  book: boolean;
  setId: string | null;
  /** Inactive: no longer drops, not on a page, cannot be crafted. Copies players own keep working. */
  active: boolean;
  /** draft = waiting for approval in the admin panel; the game never sees drafts. */
  status: 'draft' | 'live';
  /** Position inside its set (book page order). */
  order: number;
  art: ArtRef | null;
  /** null = never from the water (craft, chest or shop only). */
  drop: DropDef | null;
  /** null = not craftable. */
  recipe: RecipeSpec | null;
  /** Type bait only: shop price and what it does. */
  bait?: BaitDef;
  updatedAt: number;
}

/** A collection set. Its book items make one Collection Book page. */
export interface ContentSet {
  id: string;
  name: string;
  active: boolean;
  order: number;
  createdAt: number;
}

export interface ContentDoc {
  format: typeof CONTENT_FORMAT;
  items: ContentItem[];
  sets: ContentSet[];
  /** Category weights, 10000 = %100 (03-balik-tutma.md 5.0.1). */
  catchTable: CatchTable;
  /** Streak day 1..N chests. */
  chests: ChestDef[];
  quests: QuestDef[];
  updatedAt: number;
}

/** What the rules use, built from a ContentDoc. */
export interface ContentRuntime {
  pool: ItemDef[];
  recipes: RecipeDef[];
  pages: BookPage[];
  starter: Stack[];
  baits: { [defId: string]: BaitDef };
  catchTable: CatchTable;
  chests: ChestDef[];
  quests: QuestDef[];
  /** Every live item and recipe, active or not, so old copies still sell and show a name. */
  known: { [defId: string]: KnownItem };
  /** Every set in order, active or not (old items keep their set name). */
  sets: { id: string; name: string; active: boolean }[];
  /** The doc's updatedAt: changes on every publish. */
  updatedAt: number;
}

export interface KnownItem {
  id: string;
  name: string;
  category: Category | null;
  type: ItemType | 'recipe';
  tier: Tier | null;
  setId: string | null;
  active: boolean;
  art: ArtRef | null;
}

export const ID_PATTERN = /^[a-z0-9][a-z0-9_.]{1,63}$/;
const NAME_MAX = 40;

/** "glass_bottle_blue" or "lake.fish.old_turtle" → "Glass Bottle Blue" / "Old Turtle". */
export function nameFromId(id: string): string {
  const last = id.slice(id.lastIndexOf('.') + 1);
  return last
    .split('_')
    .filter((w) => w.length > 0)
    .map((w) => w[0].toUpperCase() + w.slice(1))
    .join(' ');
}

/** The recipe id a newly craftable item gets: "craft.scale_charm" → "recipe.scale_charm". */
export function recipeIdFor(itemId: string): string {
  return 'recipe.' + itemId.slice(itemId.lastIndexOf('.') + 1);
}

/** The category the catch table and prices use. Bait has none: it never comes out of the water. */
export function categoryOfItem(it: Pick<ContentItem, 'type' | 'tier'>): Category | null {
  if (it.type === 'item') return it.tier;
  if (it.type === 'bait') return null;
  return it.type;
}

const isLive = (it: ContentItem) => it.status === 'live';

function itemDef(id: string, category: Category, d: DropDef): ItemDef {
  const out: ItemDef = { id, category };
  if (d.waters && d.waters.length > 0) out.waters = d.waters.slice();
  if (d.bands && d.bands.length > 0) out.bands = d.bands.slice();
  if (d.baits && d.baits.length > 0) out.baits = d.baits.slice();
  if (d.minLevel && d.minLevel > 1) out.minLevel = d.minLevel;
  if (d.weight !== undefined && d.weight !== 1) out.weight = d.weight;
  return out;
}

function byOrder<T extends { order: number; id: string }>(a: T, b: T): number {
  return a.order - b.order || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
}

/** Builds the rule inputs. Assumes a valid doc (validateContent); drafts are left out. */
export function compileContent(doc: ContentDoc): ContentRuntime {
  const live = doc.items.filter(isLive);
  const activeSets: { [id: string]: boolean } = {};
  for (const s of doc.sets) activeSets[s.id] = s.active;
  // An item in an inactive set is inactive too.
  const on = (it: ContentItem) => it.active && (it.setId === null || activeSets[it.setId] === true);

  const pool: ItemDef[] = [];
  const recipes: RecipeDef[] = [];
  const starter: Stack[] = [];
  const baits: { [defId: string]: BaitDef } = {};
  const known: { [defId: string]: KnownItem } = {};

  for (const it of live) {
    const category = categoryOfItem(it);
    known[it.id] = { id: it.id, name: it.name, category, type: it.type, tier: it.tier, setId: it.setId, active: on(it), art: it.art };
    if (it.recipe) {
      known[it.recipe.id] = {
        id: it.recipe.id,
        name: 'Recipe: ' + it.name,
        category: 'recipe',
        type: 'recipe',
        tier: null,
        setId: it.setId,
        active: on(it),
        art: null,
      };
    }
    if (!on(it)) continue;
    if (it.drop && category) pool.push(itemDef(it.id, category, it.drop));
    if (it.type === 'bait' && it.bait) baits[it.id] = it.bait;
    const r = it.recipe;
    if (r) {
      if (r.drop) pool.push(itemDef(r.id, 'recipe', r.drop));
      const output = it.type === 'item' && it.tier ? { defId: it.id, tier: it.tier } : { defId: it.id, count: r.count || 1 };
      const def: RecipeDef = { id: r.id, grade: r.grade, output, stacks: r.stacks.map((s) => ({ ...s })), items: r.items.map((s) => ({ ...s })) };
      if (it.type !== 'item') def.dust = r.dust || 0;
      recipes.push(def);
      if (r.starter > 0) starter.push({ defId: r.id, count: r.starter });
    }
  }

  // One page per active set, in set order; only active book items, in item order.
  const pages: BookPage[] = [];
  for (const s of doc.sets.slice().sort(byOrder)) {
    if (!s.active) continue;
    const items = live.filter((it) => it.setId === s.id && it.book && on(it)).sort(byOrder).map((it) => it.id);
    if (items.length > 0) pages.push({ id: s.id, items });
  }

  const isOn = (id: string) => known[id] !== undefined && known[id].active;
  const chests = doc.chests.map((c) => ({
    coin: [c.coin[0], c.coin[1]] as [number, number],
    dust: [c.dust[0], c.dust[1]] as [number, number],
    rolls: c.rolls,
    pool: c.pool.filter((e) => isOn(e.defId)).map((e) => ({ ...e })),
    guaranteed: c.guaranteed.filter((e) => isOn(e.defId)).map((e) => ({ ...e })),
  }));

  const sets = doc.sets.slice().sort(byOrder).map((s) => ({ id: s.id, name: s.name, active: s.active }));
  return { pool, recipes, pages, starter, baits, catchTable: { ...doc.catchTable }, chests, quests: doc.quests.map((q) => ({ ...q })), known, sets, updatedAt: doc.updatedAt };
}

// --- validation ---

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const isInt = (v: unknown, min: number, max: number): v is number => typeof v === 'number' && Number.isInteger(v) && v >= min && v <= max;
const isNum = (v: unknown, min: number, max: number): v is number => typeof v === 'number' && Number.isFinite(v) && v >= min && v <= max;

export interface ValidateOptions {
  /** Named waters of the map file; drop.waters must be among them. Unchecked if missing. */
  waters?: string[];
  maxLevel?: number;
}

function checkDrop(where: string, d: unknown, baitIds: { [id: string]: boolean }, opt: ValidateOptions, err: (m: string) => void): void {
  if (d === null) return;
  if (!isObj(d)) return err(`${where}: drop must be an object or null`);
  if (d.waters !== undefined) {
    if (!Array.isArray(d.waters) || !d.waters.every((w) => typeof w === 'string' && w.length > 0)) err(`${where}: drop.waters must be a list of water ids`);
    else if (opt.waters) for (const w of d.waters as string[]) if (opt.waters.indexOf(w) < 0) err(`${where}: water "${w}" is not on the map`);
  }
  if (d.bands !== undefined && (!Array.isArray(d.bands) || !d.bands.every((b) => BANDS.indexOf(b as Band) >= 0))) err(`${where}: drop.bands must be shore, mid or deep`);
  if (d.baits !== undefined) {
    if (!Array.isArray(d.baits)) err(`${where}: drop.baits must be a list`);
    else for (const b of d.baits) if (typeof b !== 'string' || !baitIds[b]) err(`${where}: bait "${String(b)}" is not a bait item`);
  }
  if (d.minLevel !== undefined && !isInt(d.minLevel, 1, opt.maxLevel || 1000)) err(`${where}: drop.minLevel must be a whole number from 1`);
  if (d.weight !== undefined && !isNum(d.weight, 0.01, 1000)) err(`${where}: drop.weight must be between 0.01 and 1000`);
}

function checkStacks(where: string, list: unknown, err: (m: string) => void): Stack[] {
  if (!Array.isArray(list)) {
    err(`${where} must be a list`);
    return [];
  }
  const out: Stack[] = [];
  for (const s of list) {
    if (!isObj(s) || typeof s.defId !== 'string' || !isInt(s.count, 1, 99)) err(`${where}: each entry needs defId and count 1-99`);
    else out.push({ defId: s.defId, count: s.count as number });
  }
  return out;
}

/** Every problem with the doc, in plain words; empty when it is good to publish. */
export function validateContent(doc: unknown, opt: ValidateOptions = {}): string[] {
  const errors: string[] = [];
  const err = (m: string) => {
    if (errors.length < 200) errors.push(m);
  };
  if (!isObj(doc)) return ['content must be an object'];
  if (doc.format !== CONTENT_FORMAT) err(`format must be ${CONTENT_FORMAT}`);
  if (!Array.isArray(doc.items) || !Array.isArray(doc.sets) || !Array.isArray(doc.chests) || !Array.isArray(doc.quests) || !isObj(doc.catchTable)) {
    return errors.concat(['items, sets, chests, quests and catchTable are required']);
  }

  const setIds: { [id: string]: boolean } = {};
  for (const s of doc.sets as unknown[]) {
    if (!isObj(s) || typeof s.id !== 'string' || !ID_PATTERN.test(s.id)) {
      err('set: id must be lowercase letters, digits, _ or .');
      continue;
    }
    if (setIds[s.id]) err(`set ${s.id}: id used twice`);
    setIds[s.id] = true;
    if (typeof s.name !== 'string' || s.name.trim().length === 0 || s.name.length > NAME_MAX) err(`set ${s.id}: name is required (max ${NAME_MAX})`);
    if (typeof s.active !== 'boolean') err(`set ${s.id}: active must be true or false`);
    if (!isNum(s.order, -1e9, 1e9)) err(`set ${s.id}: order must be a number`);
  }

  // Ids first, so references can be checked in any order.
  const ids: { [id: string]: ContentItem } = {};
  const baitIds: { [id: string]: boolean } = {};
  const items = (doc.items as unknown[]).filter(isObj) as unknown as ContentItem[];
  if (items.length !== (doc.items as unknown[]).length) err('items: every entry must be an object');
  for (const it of items) {
    if (typeof it.id !== 'string' || !ID_PATTERN.test(it.id)) {
      err(`item "${String(it.id)}": id must be 2-64 lowercase letters, digits, _ or .`);
      continue;
    }
    if (ids[it.id]) err(`item ${it.id}: id used twice`);
    ids[it.id] = it;
    if (it.type === 'bait') baitIds[it.id] = true;
  }
  for (const it of items) {
    if (it.recipe && isObj(it.recipe) && typeof it.recipe.id === 'string') {
      if (!ID_PATTERN.test(it.recipe.id)) err(`item ${it.id}: recipe id is not valid`);
      else if (ids[it.recipe.id]) err(`item ${it.id}: recipe id ${it.recipe.id} is already used`);
      else ids[it.recipe.id] = it;
    }
  }

  for (const it of items) {
    if (typeof it.id !== 'string' || !ID_PATTERN.test(it.id)) continue;
    const w = `item ${it.id}`;
    if (typeof it.name !== 'string' || it.name.trim().length === 0 || it.name.length > NAME_MAX) err(`${w}: name is required (max ${NAME_MAX})`);
    if (ITEM_TYPES.indexOf(it.type) < 0) err(`${w}: type must be one of ${ITEM_TYPES.join(', ')}`);
    if (it.tier !== null && TIERS.indexOf(it.tier) < 0) err(`${w}: tier must be ${TIERS.join(', ')} or empty`);
    if (it.type === 'item' && !it.tier) err(`${w}: an item with Float needs a Tier`);
    if (typeof it.book !== 'boolean') err(`${w}: book must be true or false`);
    if (it.book && it.type !== 'item') err(`${w}: only items with Float can be book records`);
    if (it.book && !it.setId) err(`${w}: a book record needs a set (the set is its page)`);
    if (it.setId !== null && (typeof it.setId !== 'string' || !setIds[it.setId])) err(`${w}: set ${String(it.setId)} does not exist`);
    if (typeof it.active !== 'boolean') err(`${w}: active must be true or false`);
    if (it.status !== 'draft' && it.status !== 'live') err(`${w}: status must be draft or live`);
    if (!isNum(it.order, -1e9, 1e9)) err(`${w}: order must be a number`);
    if (it.art !== null && !(isObj(it.art) && typeof it.art.hash === 'string' && isInt(it.art.w, 1, 1024) && isInt(it.art.h, 1, 1024))) err(`${w}: art is broken`);
    if (it.type === 'bait') {
      if (it.drop !== null) err(`${w}: bait comes from the shop or a recipe, not the water`);
      const b = it.bait as unknown;
      if (!isObj(b) || !isInt(b.price, 1, 1e6) || !isObj(b.boost)) err(`${w}: bait needs a price and a boost`);
      else {
        if (b.bands !== undefined && (!Array.isArray(b.bands) || !b.bands.every((x) => BANDS.indexOf(x as Band) >= 0))) err(`${w}: bait bands must be shore, mid or deep`);
        for (const k in b.boost as Record<string, unknown>) {
          if (CATEGORIES.indexOf(k as Category) < 0) err(`${w}: bait boost "${k}" is not a category`);
          else if (!isNum((b.boost as Record<string, unknown>)[k], 0, 100)) err(`${w}: bait boost ${k} must be 0-100`);
        }
      }
    } else if (it.bait !== undefined) err(`${w}: only bait items have bait settings`);
    checkDrop(w, it.drop, baitIds, opt, err);

    const r = it.recipe as unknown;
    if (r === null) continue;
    if (!isObj(r)) {
      err(`${w}: recipe must be an object or null`);
      continue;
    }
    if (typeof r.id !== 'string') err(`${w}: recipe needs an id`);
    if (GRADES.indexOf(r.grade as RecipeGrade) < 0) err(`${w}: recipe grade must be ${GRADES.join(', ')}`);
    const stacks = checkStacks(`${w}: recipe stacks`, r.stacks, err);
    const inputs = checkStacks(`${w}: recipe items`, r.items, err);
    if (stacks.length + inputs.length === 0) err(`${w}: recipe needs at least one input`);
    const seen: { [id: string]: boolean } = {};
    for (const s of stacks) {
      const src = ids[s.defId];
      if (s.defId === it.id) err(`${w}: recipe cannot use the item it makes`);
      else if (!src || src.id !== s.defId) err(`${w}: recipe input ${s.defId} does not exist`);
      else if (src.type === 'item') err(`${w}: ${s.defId} has Float, put it under recipe items`);
      if (seen[s.defId]) err(`${w}: recipe lists ${s.defId} twice`);
      seen[s.defId] = true;
    }
    for (const s of inputs) {
      const src = ids[s.defId];
      if (s.defId === it.id) err(`${w}: recipe cannot use the item it makes`);
      else if (!src || src.id !== s.defId) err(`${w}: recipe input ${s.defId} does not exist`);
      else if (src.type !== 'item') err(`${w}: ${s.defId} stacks, put it under recipe stacks`);
      if (seen[s.defId]) err(`${w}: recipe lists ${s.defId} twice`);
      seen[s.defId] = true;
    }
    if (it.type === 'item') {
      if (r.count !== undefined || r.dust !== undefined) err(`${w}: count and dust are only for stack outputs`);
    } else {
      if (!isInt(r.count, 1, 99)) err(`${w}: a stack output needs count 1-99`);
      if (!isInt(r.dust, 0, 1e6)) err(`${w}: a stack output needs its dust cost (0 or more)`);
    }
    if (!isInt(r.starter, 0, 99)) err(`${w}: recipe starter must be 0-99`);
    checkDrop(`${w} recipe`, r.drop, baitIds, opt, err);
  }

  const table = doc.catchTable as Record<string, unknown>;
  for (const k in table) {
    if (CATEGORIES.indexOf(k as Category) < 0) err(`catch table: "${k}" is not a category`);
    else if (!isInt(table[k], 0, 1e6)) err(`catch table ${k}: must be a whole number 0 or more`);
  }

  const known = (id: unknown) => typeof id === 'string' && ids[id] !== undefined;
  const stackLike = (id: string) => {
    const owner = ids[id];
    return owner !== undefined && (owner.id !== id || owner.type !== 'item');
  };
  (doc.chests as unknown[]).forEach((c, i) => {
    const w = `chest day ${i + 1}`;
    if (!isObj(c)) return err(`${w}: must be an object`);
    const range = (v: unknown) => Array.isArray(v) && v.length === 2 && isInt(v[0], 0, 1e7) && isInt(v[1], 0, 1e7) && v[0] <= v[1];
    if (!range(c.coin)) err(`${w}: coin must be [min, max]`);
    if (!range(c.dust)) err(`${w}: dust must be [min, max]`);
    if (!isInt(c.rolls, 0, 20)) err(`${w}: rolls must be 0-20`);
    if (!Array.isArray(c.pool)) err(`${w}: pool must be a list`);
    else
      for (const e of c.pool) {
        if (!isObj(e) || !known(e.defId) || !isInt(e.count, 1, 99) || !isNum(e.weight, 0, 1e6)) err(`${w}: pool entries need a known defId, count 1-99 and weight`);
        else if (!stackLike(e.defId as string)) err(`${w}: ${String(e.defId)} has Float; chests give stacks only`);
      }
    if (!Array.isArray(c.guaranteed)) err(`${w}: guaranteed must be a list`);
    else
      for (const e of c.guaranteed) {
        if (!isObj(e) || !known(e.defId) || !isInt(e.count, 1, 99)) err(`${w}: guaranteed entries need a known defId and count 1-99`);
        else if (!stackLike(e.defId as string)) err(`${w}: ${String(e.defId)} has Float; chests give stacks only`);
      }
  });
  if ((doc.chests as unknown[]).length === 0) err('chests: at least one chest is needed');

  const questIds: { [id: string]: boolean } = {};
  for (const q of doc.quests as unknown[]) {
    if (!isObj(q) || typeof q.id !== 'string' || !ID_PATTERN.test(q.id)) {
      err('quest: id must be lowercase letters, digits, _ or .');
      continue;
    }
    if (questIds[q.id]) err(`quest ${q.id}: id used twice`);
    questIds[q.id] = true;
    if (QUEST_EVENTS.indexOf(q.event as QuestEvent) < 0) err(`quest ${q.id}: event must be ${QUEST_EVENTS.join(', ')}`);
    if (!isInt(q.target, 1, 10000)) err(`quest ${q.id}: target must be 1 or more`);
    if (q.minTier !== undefined && TIERS.indexOf(q.minTier as Tier) < 0) err(`quest ${q.id}: minTier must be a Tier`);
    if (q.minLevel !== undefined && !isInt(q.minLevel, 1, opt.maxLevel || 1000)) err(`quest ${q.id}: minLevel must be 1 or more`);
  }
  return errors;
}

/**
 * Problems with changing a live item from `before` to `after` that would break copies players
 * already own. Drafts can change freely.
 */
export function checkLiveChange(before: ContentItem, after: ContentItem): string[] {
  if (before.status !== 'live') return [];
  const out: string[] = [];
  if (after.status !== 'live') out.push(`item ${before.id}: a live item cannot go back to draft (make it inactive instead)`);
  const stacks = (t: ItemType) => t !== 'item';
  if (stacks(before.type) !== stacks(after.type)) out.push(`item ${before.id}: players own copies, it cannot switch between Float item and stack`);
  if (before.recipe && (!after.recipe || after.recipe.id !== before.recipe.id)) {
    out.push(`item ${before.id}: players may own recipe ${before.recipe.id}; keep the recipe (turn its drop off or make the item inactive)`);
  }
  return out;
}

/** A fresh item with the defaults the admin panel starts from. */
export function newItem(id: string, now: number, over: Partial<ContentItem> = {}): ContentItem {
  return {
    id,
    name: nameFromId(id),
    type: 'item',
    tier: 'common',
    book: false,
    setId: null,
    active: true,
    status: 'draft',
    order: 0,
    art: null,
    drop: null,
    recipe: null,
    updatedAt: now,
    ...over,
  };
}
