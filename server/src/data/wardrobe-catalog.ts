// The wardrobe catalog built from the craft table (content/wardrobe/catalog.json, made by
// tools/wardrobe/build_catalog.py). It seeds the content doc's `wardrobe` until the admin
// panel stores its own copy (docs/tasarim/20-gardirop.md).
import catalogFile from '../../../content/wardrobe/catalog.json';
import { WardrobeCatalog } from '../rules/wardrobe';

export function seedWardrobe(): WardrobeCatalog {
  const f = catalogFile as unknown as WardrobeCatalog;
  return JSON.parse(JSON.stringify({ parts: f.parts, colors: f.colors, materials: f.materials, families: f.families })) as WardrobeCatalog;
}

/**
 * A wardrobe stored before craft materials existed gets the seed's materials, family ladders and
 * recipes (parts the seed knows, only where the stored part has none). The next publish stores them.
 */
export function addSeedCraft(w: WardrobeCatalog): void {
  if (w.materials !== undefined) return;
  const seed = seedWardrobe();
  w.materials = seed.materials;
  w.families = seed.families;
  const byId: { [id: string]: WardrobeCatalog['parts'][number] } = {};
  for (const p of seed.parts) byId[p.id] = p;
  for (const p of w.parts) {
    const s = byId[p.id];
    if (!s) continue;
    if (p.recipe === undefined && s.recipe !== undefined && !p.free) p.recipe = s.recipe;
    if (p.mythic === undefined && s.mythic !== undefined) {
      const m: { [fx: string]: { mats: { mat: string; count: number }[] } } = {};
      for (const fx of Object.keys(s.mythic)) if (p.effects.indexOf(fx) >= 0) m[fx] = s.mythic[fx];
      p.mythic = m;
    }
  }
}
