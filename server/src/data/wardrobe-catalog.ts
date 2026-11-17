// The wardrobe catalog built from the craft table (content/wardrobe/catalog.json, made by
// tools/wardrobe/build_catalog.py). It seeds the content doc's `wardrobe` until the admin
// panel stores its own copy (docs/tasarim/20-gardirop.md).
import catalogFile from '../../../content/wardrobe/catalog.json';
import { WardrobeCatalog } from '../rules/wardrobe';

export function seedWardrobe(): WardrobeCatalog {
  const f = catalogFile as unknown as WardrobeCatalog;
  return JSON.parse(JSON.stringify({ parts: f.parts, colors: f.colors })) as WardrobeCatalog;
}
