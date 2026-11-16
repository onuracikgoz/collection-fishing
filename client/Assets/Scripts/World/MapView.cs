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
        // Drawn by tools/pixel-art/windmill.py: tower (shadow included) and a sheet of sail frames.
        const string WindmillTower = "custom/Windmill/windmill_tower.png";
        const string WindmillSails = "custom/Windmill/windmill_sails.png";
        const int WindmillFrames = 6;
        const float WindmillPivotY = 0.1297f; // base centre of the tower, printed by the script
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
                    tiles[i] = PreviewGroundTile(col, row, h); // TEMP ground preview (was dirt[h % dirt.Length])
                }
                else
                {
                    tiles[i] = PreviewGroundTile(col, row, h); // TEMP ground preview (was grass[h % grass.Length])
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
            BuildWindmill();
            BuildDecor();
        }

        void BuildWindmill()
        {
            var tex = ArtCatalog.Texture(WindmillTower);
            var sheet = ArtCatalog.Texture(WindmillSails);
            if (tex == null || sheet == null) return;
            var go = new GameObject("Windmill");
            go.transform.SetParent(transform, false);
            // Tower base centre on the middle of its blocked tiles (LakeMap.Windmill).
            var w = LakeMap.Windmill;
            go.transform.position = Coords.ToUnity(new Vector2(w.x + w.width / 2f, w.y + w.height / 2f));
            var tower = go.AddComponent<SpriteRenderer>();
            tower.sprite = ArtCatalog.Sprite(WindmillTower, new RectInt(0, 0, tex.width, tex.height), 0.5f, WindmillPivotY);
            // Sort by the bottom of the sprite, like MapObject.
            var feet = -tower.bounds.min.y;
            tower.sortingOrder = CharacterView.SortingOrderFor(feet);

            var sails = new GameObject("Sails");
            sails.transform.SetParent(go.transform, false);
            var sr = sails.AddComponent<SpriteRenderer>();
            sr.sortingOrder = tower.sortingOrder + 1;
            var fw = sheet.width / WindmillFrames;
            var frames = new Sprite[WindmillFrames];
            for (var i = 0; i < WindmillFrames; i++)
                frames[i] = ArtCatalog.Sprite(WindmillSails, new RectInt(i * fw, 0, fw, sheet.height), 0.5f, WindmillPivotY);
            sails.AddComponent<SpriteLoop>().Play(frames, 8f);
        }

        // ---------- Map decor: Gemini buildings and the café terrace (docs/tasarim/15-gorsel-stil.md) ----------
        // Placed on the code-drawn map until the map prefab exists. Their bottom rows are blocked in
        // LakeMapData.cs and content/maps/lake.json (door column left open); chairs are the map seats.
        static readonly Vector2 CafeBase = new Vector2(54.5f, 63f);         // café bottom-centre, south of the plaza
        static readonly Vector2 FishShopBase = new Vector2(70.25f, 42f);   // fishing shop, north-east of the plaza by the lake
        // Tiles kept free of the ground preview's patches.
        static readonly RectInt[] DecorArea = { new RectInt(44, 56, 21, 17), new RectInt(64, 33, 12, 10) };
        const string Teras = "custom/Cafe/Teras/";

        /// <summary>A chair of content/maps/lake.json `seats` (kafe_1..), drawn here.</summary>
        public sealed class MapSeat
        {
            public string Id;
            public Vector2 Feet;      // chair bottom-centre, server tiles
            public int Row;           // LPC Sitting row (col 2 = chair pose)
            public Vector2 FramePx;   // bottom-centre of the 64 px frame from the chair's bottom-centre, px, +y down
            public int ChairOrder;
            public bool ChairInFront; // sandalye_arka: the backrest hides the sitter
        }
        public static readonly System.Collections.Generic.List<MapSeat> Seats = new();

        public static MapSeat FindSeat(string id) =>
            string.IsNullOrEmpty(id) ? null : Seats.Find(s => s.Id == id);

        /// <summary>A sprite standing on the ground: bottom-centre at <paramref name="feet"/> (pivotY up from the image bottom), sorted by its feet.</summary>
        int PlaceDecor(string path, Vector2 feet, float pivotPx = 0f)
        {
            var tex = ArtCatalog.Texture(path);
            if (tex == null) return 0;
            var go = new GameObject("Decor " + path);
            go.transform.SetParent(transform, false);
            go.transform.position = Coords.ToUnity(feet);
            var sr = go.AddComponent<SpriteRenderer>();
            sr.sprite = ArtCatalog.Sprite(path, new RectInt(0, 0, tex.width, tex.height), 0.5f, pivotPx / tex.height);
            sr.sortingOrder = CharacterView.SortingOrderFor(feet.y);
            return sr.sortingOrder;
        }

        void PlaceChair(string name, Vector2 feet)
        {
            var order = PlaceDecor(Teras + name + ".png", feet);
            var (row, px, front) = name switch
            {
                "sandalye_on" => (2, new Vector2(-4, -3), false),
                "sandalye_arka" => (0, new Vector2(-4, -4), true),
                "sandalye_yan_sag" => (3, new Vector2(-6, 0), false),
                _ => (1, Vector2.zero, false), // sandalye_yan_sol
            };
            Seats.Add(new MapSeat { Id = "kafe_" + (Seats.Count + 1), Feet = feet, Row = row, FramePx = px, ChairOrder = order, ChairInFront = front });
        }

        void BuildDecor()
        {
            // Fishing shop; the crates reach the image bottom, the ground line is ~6 px above it.
            PlaceDecor("custom/Buildings/balikci_gemini.png", FishShopBase, 6f);

            PlaceDecor("custom/Cafe/kafe_gemini.png", CafeBase);
            Seats.Clear();
            // Square table with the parasol and four chairs (kafe_1..4).
            var t = CafeBase + new Vector2(-3.5f, 3.5f);
            PlaceDecor(Teras + "masa_kare.png", t);
            PlaceDecor(Teras + "semsiye.png", t + new Vector2(4f / 32f, 1f / 32f));
            PlaceChair("sandalye_on", t + new Vector2(0f, -1f));
            PlaceChair("sandalye_arka", t + new Vector2(0f, 1f));
            PlaceChair("sandalye_yan_sag", t + new Vector2(-1.25f, 0f));
            PlaceChair("sandalye_yan_sol", t + new Vector2(1.25f, 0f));
            // Round table with two side chairs (kafe_5, kafe_6).
            var r = CafeBase + new Vector2(3.5f, 3.5f);
            PlaceDecor(Teras + "masa_yuvarlak.png", r);
            PlaceChair("sandalye_yan_sag", r + new Vector2(-1.25f, 0f));
            PlaceChair("sandalye_yan_sol", r + new Vector2(1.25f, 0f));
            // Benches.
            PlaceDecor(Teras + "bank_on.png", CafeBase + new Vector2(-1.5f, 6.5f));
            PlaceDecor(Teras + "bank_arka.png", CafeBase + new Vector2(1.5f, 6.5f));
        }

        // TEMP ground preview: our own tiles (tools/pixel-art/ground.py) instead of the LPC grass,
        // with a few snow and dirt patches on the grass. Roads, plaza, lake and pier stay LPC.
        // Remove when the map prefab gets painted.
        const string GroundBase = "custom/Ground/zemin-cesitler.png"; // 8 variants per row: grass, dirt, snow, sand, water, pave
        const string SnowEdge = "custom/Ground/kar-cimen-gecis-16.png";    // corner bit 1 = grass, 0 = snow
        const string DirtEdge = "custom/Ground/cimen-toprak-gecis-16.png"; // corner bit 1 = dirt, 0 = grass
        const byte VGrass = 0, VSnow = 1, VDirt = 2;
        // (centre x, centre y, radius x, radius y, material, seed) in server tiles.
        static readonly (float x, float y, float rx, float ry, byte m, int seed)[] PreviewPatches =
        {
            (34f, 70f, 4.5f, 3.2f, VSnow, 1), // south of the second building row
            (40f, 15f, 4.5f, 3.2f, VDirt, 2), // north of the first building row
            (22f, 20f, 5f, 4f, VSnow, 3),
            (100f, 82f, 5f, 4f, VSnow, 4),
            (25f, 78f, 4f, 3.5f, VSnow, 5),
            (42f, 86f, 5f, 3.5f, VDirt, 6),
            (100f, 14f, 4.5f, 3.5f, VDirt, 7),
            (8f, 14f, 3.5f, 3f, VDirt, 8),
            (70.5f, 62f, 2.6f, 3.6f, VSnow, 9), // between the south road and the lake, a few steps from spawn
        };
        byte[,] previewVerts;
        readonly System.Collections.Generic.Dictionary<(string, int, int), Tile> previewTiles = new();

        Tile PreviewTile(string path, int x, int y)
        {
            if (!previewTiles.TryGetValue((path, x, y), out var tile))
                previewTiles[(path, x, y)] = tile = NewTile(ArtCatalog.Sprite(path, new RectInt(x * T, y * T, T, T)));
            return tile;
        }

        static bool PreviewKeepOut(int col, int row)
        {
            if (col < 1 || row < 1 || col >= LakeMap.Width - 1 || row >= LakeMap.Height - 1) return true;
            var p = new Vector2Int(col, row);
            if (InRoad(col, row)) return true;
            var lake = LakeMap.Lake;
            if (new RectInt(lake.x - 2, lake.y - 2, lake.width + 4, lake.height + 4).Contains(p)) return true;
            var w = LakeMap.Windmill;
            if (new RectInt(w.x - 2, w.y - 4, w.width + 4, w.height + 6).Contains(p)) return true;
            var f = LakeMap.Fountain;
            if (new RectInt(f.x - 2, f.y - 3, f.width + 4, f.height + 5).Contains(p)) return true;
            foreach (var r in DecorArea)
                if (r.Contains(p)) return true;
            return false;
        }

        void BuildPreviewVerts()
        {
            int w = LakeMap.Width, h = LakeMap.Height;
            previewVerts = new byte[w + 1, h + 1];
            for (var vy = 0; vy <= h; vy++)
            for (var vx = 0; vx <= w; vx++)
            {
                // Roads and plaza in our dirt: a corner of any road tile is dirt, so the edge
                // goes through the grass tiles beside the road with the cimen-toprak transition.
                if (InRoad(vx - 1, vy - 1) || InRoad(vx, vy - 1) || InRoad(vx - 1, vy) || InRoad(vx, vy))
                {
                    previewVerts[vx, vy] = VDirt;
                    continue;
                }
                // A corner may change only if every tile within 2 of it is free grass.
                var free = true;
                for (var ty = vy - 2; ty <= vy + 1 && free; ty++)
                for (var tx = vx - 2; tx <= vx + 1 && free; tx++)
                    if (PreviewKeepOut(tx, ty)) free = false;
                if (!free) continue;
                foreach (var b in PreviewPatches)
                {
                    var r = new System.Random(b.seed);
                    float p0 = (float)r.NextDouble() * 6.283f, p1 = (float)r.NextDouble() * 6.283f, p2 = (float)r.NextDouble() * 6.283f;
                    float dx = (vx - b.x) / b.rx, dy = (vy - b.y) / b.ry;
                    var a = Mathf.Atan2(dy, dx);
                    var edge = 1f + 0.28f * Mathf.Sin(3 * a + p0) + 0.18f * Mathf.Sin(5 * a + p1) + 0.1f * Mathf.Sin(2 * a + p2)
                               + 0.12f * ((Hash(vx + 500, vy) % 100) / 100f - 0.5f);
                    if (Mathf.Sqrt(dx * dx + dy * dy) < edge) previewVerts[vx, vy] = b.m;
                }
            }
        }

        Tile PreviewGroundTile(int col, int row, int h)
        {
            if (previewVerts == null) BuildPreviewVerts();
            byte nw = previewVerts[col, row], ne = previewVerts[col + 1, row];
            byte sw = previewVerts[col, row + 1], se = previewVerts[col + 1, row + 1];
            var variant = (h >> 4) % 3;
            if (nw == VGrass && ne == VGrass && sw == VGrass && se == VGrass) return PreviewTile(GroundBase, h % 8, 0);
            if (nw == VSnow && ne == VSnow && sw == VSnow && se == VSnow) return PreviewTile(GroundBase, h % 8, 2);
            if (nw == VDirt && ne == VDirt && sw == VDirt && se == VDirt) return PreviewTile(GroundBase, h % 8, 1);
            // Mixed: grass and one other material (patches are kept apart, so never three).
            var snow = nw == VSnow || ne == VSnow || sw == VSnow || se == VSnow;
            int Bit(byte m) => snow ? (m == VGrass ? 1 : 0) : (m == VDirt ? 1 : 0);
            var i = Bit(nw) * 8 + Bit(ne) * 4 + Bit(sw) * 2 + Bit(se);
            return PreviewTile(snow ? SnowEdge : DirtEdge, variant * 4 + i % 4, i / 4);
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
