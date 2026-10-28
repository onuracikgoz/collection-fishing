// The first map (docs/tasarim/16-ilk-harita.md), read from the shared map file
// content/maps/lake.json (docs/protokol.md "Harita dosyası"). The file is bundled
// at build time; later it is exported from the Unity tilemap.
import lakeFile from '../../../content/maps/lake.json';
import { loadMapFile, MapFile, pointById } from '../rules/mapFile';

/** Point ids the server code depends on; the map must have them. */
export const REQUIRED_POINTS = ['bank'];

export const LAKE = loadMapFile(lakeFile as MapFile, REQUIRED_POINTS);

export const LAKE_MAP = LAKE.data;

/** Banka: the stash only opens near it. */
export const BANK_POINT = pointById(LAKE, 'bank');
