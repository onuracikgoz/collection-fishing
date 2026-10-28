using CollectionGame.Art;
using UnityEngine;
using UnityEngine.Tilemaps;

namespace CollectionGame.World
{
    /// <summary>
    /// Draws the Phase 1 test map from <see cref="LakeMap"/> with LPC terrain tiles:
    /// grass everywhere, a dirt square and roads around the fountain, the lake with
    /// a grass shore and the wooden pier. That code map is only the fallback: once the
    /// map prefab exists (Assets/Resources/Map/Lake.prefab, built and painted with the map
    /// editor, docs/araclar/harita-editoru.md) the game shows that instead.
    /// </summary>
    public class MapView : MonoBehaviour
    {
        public const int GroundOrder = MapLayout.GroundOrder;
        public const int OverlayOrder = MapLayout.DetailOrder;

        const string Terrain = "Terrain/terrain_summer.png";
        const string Bridge = "Structure/Bridges/Wood Bridge A - No Rails.png";
        const string Fountain = "Structure/Misc/Fountain A.png";
        const int T = 32;

        // Tile positions in terrain_summer.png as (column, row) of 32 px cells, top-left origin.
        static readonly Vector2Int[] GrassCells = { new(3, 1), new(4, 1), new(5, 1), new(3, 2), new(4, 2), new(5, 2) };
        static readonly Vector2Int[] DirtCells = { new(3, 3), new(4, 3), new(5, 3), new(3, 4), new(4, 4), new(5, 4) };
        static readonly Vector2Int WaterCell = new(1, 11);
        static readonly Vector2Int[] WaterSparkleCells = { new(12, 16), new(13, 16), new(14, 16), new(15, 16) };
        // 3×3 "water in grass" block; the middle cell is open water.
        static readonly Vector2Int ShoreOrigin = new(0, 10);

        // Visual only, see LakeMap for collision.
        static readonly RectInt Plaza = new RectInt(57, 42, 16, 15);
        static readonly RectInt[] Roads =
        {
            new RectInt(64, 0, 2, 42),  // north to the forest
            new RectInt(73, 47, 3, 2),  // east to the pier
            new RectInt(64, 57, 2, 39), // south to the café and beach
            new RectInt(0, 49, 57, 2),  // west to the empty lots
        };

        void Start() => Build();

        public void Build()
        {
            var prefab = MapLayout.Load();
            if (prefab != null)
            {
                BuildFromPrefab(prefab);
                return;
            }
            BuildFromCode();
        }

        void BuildFromPrefab(GameObject prefab)
        {
            var map = Instantiate(prefab, transform);
            map.name = "Map";
            // The markers are for the editor and the server's collision; players do not see them.
            foreach (var marker in new[] { MapLayout.Water, MapLayout.Blocked })
            {
                var layer = map.transform.Find(marker);
                if (layer == null) continue;
                var renderer = layer.GetComponent<TilemapRenderer>();
                if (renderer != null) renderer.enabled = false;
            }
            var spawn = map.transform.Find(MapLayout.Spawn);
            if (spawn != null)
            {
                var r = spawn.GetComponent<Renderer>();
                if (r != null) r.enabled = false;
            }
            var guide = map.GetComponent<MapGuide>();
            if (guide != null) Destroy(guide);

            // Collision comes from LakeMapData.cs (written by the editor's Export), the same numbers
            // the server uses. A mismatch means the prefab was painted after the last export.
            var hash = MapLayout.MarkerHash(map);
            if (LakeMap.MarkerHash != 0 && hash != LakeMap.MarkerHash)
                Debug.LogWarning("[Map] The map prefab's Water / Blocked / Spawn markers changed after the last export. Run CollectionGame > Map > Export, then restart the server, or walking will be corrected by the server.");
            else if (LakeMap.MarkerHash == 0)
                Debug.LogWarning("[Map] The map prefab has not been exported yet (CollectionGame > Map > Export): collision is still the old test map.");
        }

        void BuildFromCode()
        {
            var grid = new GameObject("Grid", typeof(Grid));
            grid.transform.SetParent(transform, false);

            var ground = NewLayer(grid.transform, "Ground", GroundOrder);
            var overlay = NewLayer(grid.transform, "Pier", OverlayOrder);

            var grass = Tiles(GrassCells);
            var dirt = Tiles(DirtCells);
            var water = TerrainTile(WaterCell);
            var sparkles = Tiles(WaterSparkleCells);
            var shore = new Tile[3, 3];
            for (var dx = 0; dx < 3; dx++)
            for (var dy = 0; dy < 3; dy++)
                shore[dx, dy] = TerrainTile(ShoreOrigin + new Vector2Int(dx, dy));

            var positions = new Vector3Int[LakeMap.Width * LakeMap.Height];
            var tiles = new TileBase[positions.Length];
            var i = 0;
            for (var row = 0; row < LakeMap.Height; row++)
            for (var col = 0; col < LakeMap.Width; col++, i++)
            {
                positions[i] = Coords.Cell(col, row);
                var h = Hash(col, row);
                var lake = LakeMap.Lake;
                if (lake.Contains(new Vector2Int(col, row)))
                {
                    var dx = col == lake.xMin ? 0 : col == lake.xMax - 1 ? 2 : 1;
                    var dy = row == lake.yMin ? 0 : row == lake.yMax - 1 ? 2 : 1;
                    if (dx != 1 || dy != 1) tiles[i] = shore[dx, dy];
                    else tiles[i] = h % 23 == 0 ? sparkles[h % sparkles.Length] : water;
                }
                else if (InRoad(col, row))
                {
                    tiles[i] = dirt[h % dirt.Length];
                }
                else
                {
                    tiles[i] = grass[h % grass.Length];
                }
            }
            ground.SetTiles(positions, tiles);

            // Pier planks: top and bottom rows of the light-wood bridge, end cap on the last column.
            var pier = LakeMap.Pier;
            for (var col = pier.xMin; col < pier.xMax; col++)
            for (var row = pier.yMin; row < pier.yMax; row++)
            {
                var px = col == pier.xMax - 1 ? 96 : ((col - pier.xMin) % 3) * T;
                var py = 96 + 16 + (row - pier.yMin) * T;
                overlay.SetTile(Coords.Cell(col, row), NewTile(ArtCatalog.Sprite(Bridge, new RectInt(px, py, T, T))));
            }

            BuildFountain();
        }

        void BuildFountain()
        {
            // 64×96 image, the art fills the top 82 px. Feet of the sprite on the fountain's south edge.
            var sprite = ArtCatalog.Sprite(Fountain, new RectInt(0, 0, 64, 82), 0.5f, 0f);
            var go = new GameObject("Fountain");
            go.transform.SetParent(transform, false);
            var f = LakeMap.Fountain;
            go.transform.position = Coords.ToUnity(new Vector2(f.x + f.width / 2f, f.yMax));
            var sr = go.AddComponent<SpriteRenderer>();
            sr.sprite = sprite;
            sr.sortingOrder = CharacterView.SortingOrderFor(f.yMax);
        }

        static bool InRoad(int col, int row)
        {
            var p = new Vector2Int(col, row);
            if (Plaza.Contains(p)) return true;
            foreach (var r in Roads)
                if (r.Contains(p)) return true;
            return false;
        }

        static Tilemap NewLayer(Transform parent, string name, int order)
        {
            var go = new GameObject(name, typeof(Tilemap), typeof(TilemapRenderer));
            go.transform.SetParent(parent, false);
            go.GetComponent<TilemapRenderer>().sortingOrder = order;
            return go.GetComponent<Tilemap>();
        }

        static Tile[] Tiles(Vector2Int[] cells)
        {
            var tiles = new Tile[cells.Length];
            for (var i = 0; i < cells.Length; i++) tiles[i] = TerrainTile(cells[i]);
            return tiles;
        }

        static Tile TerrainTile(Vector2Int cell) =>
            NewTile(ArtCatalog.Sprite(Terrain, new RectInt(cell.x * T, cell.y * T, T, T)));

        static Tile NewTile(Sprite sprite)
        {
            var tile = ScriptableObject.CreateInstance<Tile>();
            tile.sprite = sprite;
            tile.colliderType = Tile.ColliderType.None;
            return tile;
        }

        /// <summary>Stable per-tile noise so the grass pattern does not change between runs.</summary>
        static int Hash(int x, int y)
        {
            unchecked
            {
                var h = x * 73856093 ^ y * 19349663;
                h ^= h >> 13;
                h *= 0x5bd1e995;
                h ^= h >> 15;
                return h & 0x7fffffff;
            }
        }
    }
}
