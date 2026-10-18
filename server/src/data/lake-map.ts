// Server-side collision data for the first map (docs/tasarim/16-ilk-harita.md).
// Placeholder until the Unity tilemap exists: the client map and this file
// must agree. Later this should be exported from the tilemap, not hand-written.
import { MapData } from '../rules/map';

export const LAKE_MAP: MapData = {
  width: 128, // tiles (Öneri)
  height: 96, // tiles (Öneri)
  spawn: { x: 64.5, y: 50.5 }, // meydan, just south of the fountain
  blocked: [
    { x: 63, y: 47, w: 3, h: 2 }, // fountain
    // Büyük Göl (Faz 1 has its west half), with the crowded pier left open
    { x: 76, y: 30, w: 40, h: 17 },
    { x: 76, y: 49, w: 40, h: 18 },
    { x: 86, y: 47, w: 30, h: 2 }, // water past the pier's end
  ],
};
