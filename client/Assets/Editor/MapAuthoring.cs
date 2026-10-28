using System;
using System.Collections.Generic;
using System.Globalization;
using System.IO;
using System.Linq;
using System.Text;
using CollectionGame.World;
using UnityEditor;
using UnityEngine;
using UnityEngine.Tilemaps;

namespace CollectionGame.EditorTools
{
    /// <summary>
    /// The map editor setup (docs/araclar/harita-editoru.md). Menu: CollectionGame > Map.
    ///   Slice Selected Textures  cuts a sheet into 32x32 sprites so it can go into a Tile Palette.
    ///   Create Map Prefab        builds Assets/Resources/Map/Lake.prefab with the layers, the
    ///                            Water / Blocked / Spawn markers and a starting map, then exports.
    ///   Open Map Prefab          opens it for painting (Window > 2D > Tile Palette).
    ///   Export                   writes the collision to server/src/data/lake-map.ts and
    ///                            Assets/Scripts/World/LakeMapData.cs from the Water / Blocked / Spawn markers.
    /// The game shows the prefab (MapView); the server walks and fishes by the exported files.
    /// </summary>
    public static class MapAuthoring
    {
        const string PrefabPath = "Assets/Resources/Map/Lake.prefab";
        const string MapDir = "Assets/Map";
        const string MarkerDir = "Assets/Map/Markers";
        const string TileDir = "Assets/Map/Tiles";
        const string TerrainSheet = "Assets/Art/LPC/Terrain/terrain_summer.png";
        const string FountainArt = "Assets/Art/LPC/Structure/Misc/Fountain A.png";
        const int Cell = 32;
        static readonly CultureInfo Inv = CultureInfo.InvariantCulture;

        // ---------- slicing ----------

        [MenuItem("CollectionGame/Map/Slice Selected Textures (32x32)")]
        static void SliceSelected()
        {
            var done = 0;
            foreach (var obj in Selection.objects)
            {
                var path = AssetDatabase.GetAssetPath(obj);
                if (path.StartsWith("Assets/") && path.EndsWith(".png") && Slice(path)) done++;
            }
            EditorUtility.DisplayDialog("Dilimleme", done == 0 ? "Project penceresinde bir veya birkaç .png seç." : $"{done} dosya 32x32 parçalara bölündü. Tile Palette'e sürükleyebilirsin.", "Tamam");
        }

        /// <summary>Cuts a texture into 32x32 sprites named {file}_{col}_{row} (row 0 = top). Empty cells are skipped.</summary>
        public static bool Slice(string path)
        {
            var importer = AssetImporter.GetAtPath(path) as TextureImporter;
            if (importer == null) return false;

            var probe = new Texture2D(2, 2, TextureFormat.RGBA32, false);
            probe.LoadImage(File.ReadAllBytes(path));
            int w = probe.width, h = probe.height;
            var pixels = probe.GetPixels32();
            UnityEngine.Object.DestroyImmediate(probe);

            var name = Path.GetFileNameWithoutExtension(path);
            var metas = new List<SpriteMetaData>();
            for (var row = 0; row < h / Cell; row++)
            for (var col = 0; col < w / Cell; col++)
            {
                // Unity's texture origin is bottom-left; row 0 is the top row of the image.
                var y = h - (row + 1) * Cell;
                if (IsEmpty(pixels, w, col * Cell, y)) continue;
                metas.Add(new SpriteMetaData
                {
                    name = $"{name}_{col}_{row}",
                    rect = new Rect(col * Cell, y, Cell, Cell),
                    alignment = 0, // SpriteAlignment.Center
                    pivot = new Vector2(0.5f, 0.5f),
                });
            }

            importer.textureType = TextureImporterType.Sprite;
            importer.spriteImportMode = SpriteImportMode.Multiple;
#pragma warning disable CS0618 // the old sprite sheet API is the shortest way to slice by code
            importer.spritesheet = metas.ToArray();
#pragma warning restore CS0618
            importer.SaveAndReimport();
            return true;
        }

        static bool IsEmpty(Color32[] pixels, int width, int x0, int y0)
        {
            for (var y = y0; y < y0 + Cell; y++)
            for (var x = x0; x < x0 + Cell; x++)
                if (pixels[y * width + x].a > 0) return false;
            return true;
        }

        static Sprite SpriteOf(string path, string name) =>
            AssetDatabase.LoadAllAssetsAtPath(path).OfType<Sprite>().FirstOrDefault(s => s.name == name);

        // ---------- create ----------

        [MenuItem("CollectionGame/Map/Create Map Prefab")]
        static void CreateMenu()
        {
            if (File.Exists(PrefabPath) &&
                !EditorUtility.DisplayDialog("Harita zaten var", "Assets/Resources/Map/Lake.prefab var. Sıfırdan oluşturup üzerine yazayım mı? Boyadığın her şey gider.", "Üzerine yaz", "Vazgeç"))
                return;
            Create();
            Open();
        }

        [MenuItem("CollectionGame/Map/Open Map Prefab")]
        static void Open()
        {
            var prefab = AssetDatabase.LoadAssetAtPath<GameObject>(PrefabPath);
            if (prefab == null)
            {
                EditorUtility.DisplayDialog("Harita yok", "Önce CollectionGame > Map > Create Map Prefab.", "Tamam");
                return;
            }
            AssetDatabase.OpenAsset(prefab);
        }

        static void Create()
        {
            if (SpriteOf(TerrainSheet, "terrain_summer_3_1") == null) Slice(TerrainSheet);
            var grassSprite = SpriteOf(TerrainSheet, "terrain_summer_3_1");
            var waterSprite = SpriteOf(TerrainSheet, "terrain_summer_1_11");
            if (grassSprite == null || waterSprite == null)
            {
                EditorUtility.DisplayDialog("Dilimleme olmadı", $"{TerrainSheet} dilimlenemedi (terrain_summer_3_1 yok).", "Tamam");
                return;
            }

            EnsureFolder("Assets/Resources/Map");
            EnsureFolder(MapDir);
            EnsureFolder(MarkerDir);
            EnsureFolder(TileDir);

            var grass = TileAsset("grass", grassSprite);
            var water = TileAsset("water", waterSprite);
            var waterMarker = MarkerTile("water", new Color(0.2f, 0.5f, 1f, 1f));
            var blockedMarker = MarkerTile("blocked", new Color(1f, 0.25f, 0.2f, 1f));
            var spawnSprite = MarkerSprite("spawn", new Color(1f, 0.9f, 0.1f, 1f));

            var root = new GameObject("Lake", typeof(Grid), typeof(MapGuide));
            try
            {
                var ground = NewLayer(root, MapLayout.Ground, MapLayout.GroundOrder, 1f);
                NewLayer(root, MapLayout.Detail, MapLayout.DetailOrder, 1f);
                NewLayer(root, MapLayout.Above, MapLayout.AboveOrder, 1f);
                var waterMap = NewLayer(root, MapLayout.Water, 29000, 0.5f);
                var blockedMap = NewLayer(root, MapLayout.Blocked, 29001, 0.5f);

                // Starting point: all grass, the lake as plain water, the markers from the current collision.
                var area = new BoundsInt(0, -LakeMap.Height, 0, LakeMap.Width, LakeMap.Height, 1);
                ground.SetTilesBlock(area, Enumerable.Repeat<TileBase>(grass, LakeMap.Width * LakeMap.Height).ToArray());
                foreach (var r in LakeMap.Water)
                {
                    Fill(ground, r, water);
                    Fill(waterMap, r, waterMarker);
                }
                var inWater = new HashSet<Vector2Int>(LakeMap.Water.SelectMany(Tiles));
                foreach (var r in LakeMap.Blocked)
                    foreach (var t in Tiles(r))
                        if (!inWater.Contains(t)) blockedMap.SetTile(MapCell(t), blockedMarker);

                var spawn = new GameObject(MapLayout.Spawn, typeof(SpriteRenderer));
                spawn.transform.SetParent(root.transform, false);
                spawn.transform.position = new Vector3(LakeMap.Spawn.x, -LakeMap.Spawn.y, 0f);
                var spawnRenderer = spawn.GetComponent<SpriteRenderer>();
                spawnRenderer.sprite = spawnSprite;
                spawnRenderer.sortingOrder = 29002;

                var objects = new GameObject(MapLayout.Objects);
                objects.transform.SetParent(root.transform, false);
                AddFountain(objects.transform);

                PrefabUtility.SaveAsPrefabAsset(root, PrefabPath);
            }
            finally
            {
                UnityEngine.Object.DestroyImmediate(root);
            }
            AssetDatabase.SaveAssets();
            Export();
        }

        static void AddFountain(Transform parent)
        {
            var sprite = AssetDatabase.LoadAssetAtPath<Sprite>(FountainArt);
            if (sprite == null) return;
            // The image is 64x96 with the art in the top 82 px; its feet are 14 px above the image bottom.
            var go = new GameObject("Fountain", typeof(SpriteRenderer), typeof(MapObject));
            go.transform.SetParent(parent, false);
            var f = LakeMap.Fountain;
            var feetY = -f.yMax;
            go.transform.position = new Vector3(f.x + f.width / 2f, feetY - 14f / Cell + sprite.bounds.extents.y, 0f);
            go.GetComponent<SpriteRenderer>().sprite = sprite;
            go.GetComponent<MapObject>().feetShift = -14f / Cell;
        }

        // ---------- export ----------

        [MenuItem("CollectionGame/Map/Export (server + client)")]
        static void ExportMenu()
        {
            if (Export())
                EditorUtility.DisplayDialog("Dışa aktarıldı", "server/src/data/lake-map.ts ve LakeMapData.cs yazıldı.\n\nSunucuyu yeniden başlat:\ndocker compose up -d --force-recreate server-build nakama\n\nDosyaları commit etmeyi unutma.", "Tamam");
        }

        public static bool Export()
        {
            if (!File.Exists(PrefabPath))
            {
                EditorUtility.DisplayDialog("Harita yok", "Önce CollectionGame > Map > Create Map Prefab.", "Tamam");
                return false;
            }

            int w = LakeMap.Width, h = LakeMap.Height;
            var water = new bool[w, h];
            var blocked = new bool[w, h];
            Vector2 spawn;
            int hash;
            var outside = 0;

            var root = PrefabUtility.LoadPrefabContents(PrefabPath);
            try
            {
                var waterMap = MapLayout.Layer(root, MapLayout.Water);
                var blockedMap = MapLayout.Layer(root, MapLayout.Blocked);
                var spawnObject = root.transform.Find(MapLayout.Spawn);
                if (waterMap == null || blockedMap == null || spawnObject == null)
                {
                    EditorUtility.DisplayDialog("Harita bozuk", "Prefab'da Water, Blocked veya Spawn yok. Create Map Prefab ile yeniden oluştur.", "Tamam");
                    return false;
                }

                foreach (var cell in Cells(waterMap))
                {
                    var t = MapLayout.ToTile(cell);
                    if (t.x < 0 || t.y < 0 || t.x >= w || t.y >= h) outside++;
                    else water[t.x, t.y] = true;
                }
                foreach (var cell in Cells(blockedMap))
                {
                    var t = MapLayout.ToTile(cell);
                    if (t.x < 0 || t.y < 0 || t.x >= w || t.y >= h) outside++;
                    else if (!water[t.x, t.y]) blocked[t.x, t.y] = true;
                }
                spawn = new Vector2(spawnObject.position.x, -spawnObject.position.y);
                hash = MapLayout.MarkerHash(root);
            }
            finally
            {
                PrefabUtility.UnloadPrefabContents(root);
            }

            var sx = Mathf.FloorToInt(spawn.x);
            var sy = Mathf.FloorToInt(spawn.y);
            if (sx < 0 || sy < 0 || sx >= w || sy >= h || water[sx, sy] || blocked[sx, sy])
            {
                EditorUtility.DisplayDialog("Spawn yanlış yerde", $"Spawn ({spawn.x:0.0}, {spawn.y:0.0}) haritanın dışında ya da su / engel üstünde. Spawn nesnesini yürünebilir bir yere taşı.", "Tamam");
                return false;
            }
            if (outside > 0)
                Debug.LogWarning($"[Map] {outside} Water / Blocked tile(s) lie outside the {w}x{h} map and were ignored (x 0..{w - 1}, y -1..{-h}).");

            var waterRects = Merge(water, w, h);
            var blockedRects = Merge(blocked, w, h);
            var repo = Path.GetFullPath(Path.Combine(Application.dataPath, "..", ".."));
            File.WriteAllText(Path.Combine(repo, "server", "src", "data", "lake-map.ts"), ServerFile(w, h, spawn, waterRects, blockedRects));
            File.WriteAllText(Path.Combine(Application.dataPath, "Scripts", "World", "LakeMapData.cs"), ClientFile(w, h, spawn, waterRects, blockedRects, hash));
            AssetDatabase.Refresh();
            Debug.Log($"[Map] Exported: {waterRects.Count} water and {blockedRects.Count} blocked rectangles, spawn ({spawn.x:0.0}, {spawn.y:0.0}).");
            return true;
        }

        static string ServerFile(int w, int h, Vector2 spawn, List<RectInt> water, List<RectInt> blocked)
        {
            var sb = new StringBuilder();
            sb.AppendLine("// Collision data of the first map. Written by Unity: CollectionGame > Map > Export.");
            sb.AppendLine("// Do not edit by hand; paint the Water / Blocked / Spawn markers in Assets/Resources/Map/Lake.prefab.");
            sb.AppendLine("// The client copy is client/Assets/Scripts/World/LakeMapData.cs (docs/araclar/harita-editoru.md).");
            sb.AppendLine("import { MapData, Rect } from '../rules/map';");
            sb.AppendLine();
            sb.AppendLine("// Fishable water. Not walkable.");
            sb.AppendLine("const LAKE_WATER: Rect[] = [");
            foreach (var r in water) sb.AppendLine($"  {{ x: {r.x}, y: {r.y}, w: {r.width}, h: {r.height} }},");
            sb.AppendLine("];");
            sb.AppendLine();
            sb.AppendLine("export const LAKE_MAP: MapData = {");
            sb.AppendLine($"  width: {w}, // tiles");
            sb.AppendLine($"  height: {h}, // tiles");
            sb.AppendLine($"  spawn: {{ x: {Num(spawn.x)}, y: {Num(spawn.y)} }},");
            sb.AppendLine("  blocked: [");
            foreach (var r in blocked) sb.AppendLine($"    {{ x: {r.x}, y: {r.y}, w: {r.width}, h: {r.height} }},");
            sb.AppendLine("    ...LAKE_WATER,");
            sb.AppendLine("  ],");
            sb.AppendLine("  water: LAKE_WATER,");
            sb.AppendLine("};");
            return sb.ToString();
        }

        static string ClientFile(int w, int h, Vector2 spawn, List<RectInt> water, List<RectInt> blocked, int hash)
        {
            var sb = new StringBuilder();
            sb.AppendLine("// Collision data of the first map. Written by CollectionGame > Map > Export; do not edit by hand.");
            sb.AppendLine("// The same export writes server/src/data/lake-map.ts.");
            sb.AppendLine("using UnityEngine;");
            sb.AppendLine();
            sb.AppendLine("namespace CollectionGame.World");
            sb.AppendLine("{");
            sb.AppendLine("    public static partial class LakeMap");
            sb.AppendLine("    {");
            sb.AppendLine($"        public const int Width = {w};");
            sb.AppendLine($"        public const int Height = {h};");
            sb.AppendLine($"        public static readonly Vector2 Spawn = new Vector2({Num(spawn.x)}f, {Num(spawn.y)}f);");
            sb.AppendLine();
            sb.AppendLine("        /// <summary>Fishable water; also blocked.</summary>");
            sb.AppendLine("        public static readonly RectInt[] Water =");
            sb.AppendLine("        {");
            foreach (var r in water) sb.AppendLine($"            new RectInt({r.x}, {r.y}, {r.width}, {r.height}),");
            sb.AppendLine("        };");
            sb.AppendLine();
            sb.AppendLine("        /// <summary>Everything nobody can stand on: the water and the other blocked tiles.</summary>");
            sb.AppendLine("        public static readonly RectInt[] Blocked =");
            sb.AppendLine("        {");
            foreach (var r in blocked) sb.AppendLine($"            new RectInt({r.x}, {r.y}, {r.width}, {r.height}),");
            foreach (var r in water) sb.AppendLine($"            new RectInt({r.x}, {r.y}, {r.width}, {r.height}),");
            sb.AppendLine("        };");
            sb.AppendLine();
            sb.AppendLine("        /// <summary>Fingerprint of the map prefab's markers at export time; 0 = never exported.</summary>");
            sb.AppendLine($"        public const int MarkerHash = {hash};");
            sb.AppendLine("    }");
            sb.AppendLine("}");
            return sb.ToString();
        }

        static string Num(float v) => v.ToString("0.###", Inv);

        /// <summary>Greedy rectangles over the marked tiles, row by row.</summary>
        static List<RectInt> Merge(bool[,] marked, int w, int h)
        {
            var used = new bool[w, h];
            var rects = new List<RectInt>();
            for (var row = 0; row < h; row++)
            for (var col = 0; col < w; col++)
            {
                if (!marked[col, row] || used[col, row]) continue;
                var rw = 1;
                while (col + rw < w && marked[col + rw, row] && !used[col + rw, row]) rw++;
                var rh = 1;
                while (row + rh < h)
                {
                    var full = true;
                    for (var c = col; c < col + rw && full; c++) full = marked[c, row + rh] && !used[c, row + rh];
                    if (!full) break;
                    rh++;
                }
                for (var y = row; y < row + rh; y++)
                for (var x = col; x < col + rw; x++)
                    used[x, y] = true;
                rects.Add(new RectInt(col, row, rw, rh));
            }
            return rects;
        }

        // ---------- helpers ----------

        static IEnumerable<Vector3Int> Cells(Tilemap map)
        {
            var b = map.cellBounds;
            foreach (var cell in b.allPositionsWithin)
                if (map.HasTile(cell)) yield return cell;
        }

        static IEnumerable<Vector2Int> Tiles(RectInt r)
        {
            for (var y = r.yMin; y < r.yMax; y++)
            for (var x = r.xMin; x < r.xMax; x++)
                yield return new Vector2Int(x, y);
        }

        static Vector3Int MapCell(Vector2Int tile) => new Vector3Int(tile.x, -tile.y - 1, 0);

        static void Fill(Tilemap map, RectInt r, TileBase tile)
        {
            foreach (var t in Tiles(r)) map.SetTile(MapCell(t), tile);
        }

        static Tilemap NewLayer(GameObject root, string name, int order, float alpha)
        {
            var go = new GameObject(name, typeof(Tilemap), typeof(TilemapRenderer));
            go.transform.SetParent(root.transform, false);
            go.GetComponent<TilemapRenderer>().sortingOrder = order;
            var map = go.GetComponent<Tilemap>();
            map.color = new Color(1f, 1f, 1f, alpha);
            return map;
        }

        static void EnsureFolder(string path)
        {
            if (AssetDatabase.IsValidFolder(path)) return;
            var parent = Path.GetDirectoryName(path).Replace('\\', '/');
            EnsureFolder(parent);
            AssetDatabase.CreateFolder(parent, Path.GetFileName(path));
        }

        static Tile TileAsset(string name, Sprite sprite)
        {
            var path = $"{TileDir}/{name}.asset";
            var tile = AssetDatabase.LoadAssetAtPath<Tile>(path);
            if (tile != null) return tile;
            tile = ScriptableObject.CreateInstance<Tile>();
            tile.sprite = sprite;
            tile.colliderType = Tile.ColliderType.None;
            AssetDatabase.CreateAsset(tile, path);
            return tile;
        }

        static Tile MarkerTile(string name, Color color)
        {
            var path = $"{MarkerDir}/{name}-tile.asset";
            var tile = AssetDatabase.LoadAssetAtPath<Tile>(path);
            if (tile != null) return tile;
            return TileAssetAt(path, MarkerSprite(name, color));
        }

        static Tile TileAssetAt(string path, Sprite sprite)
        {
            var tile = ScriptableObject.CreateInstance<Tile>();
            tile.sprite = sprite;
            tile.colliderType = Tile.ColliderType.None;
            AssetDatabase.CreateAsset(tile, path);
            return tile;
        }

        /// <summary>A flat 32x32 coloured square, so markers show clearly over the art.</summary>
        static Sprite MarkerSprite(string name, Color color)
        {
            var path = $"{MarkerDir}/{name}.png";
            if (!File.Exists(path))
            {
                var tex = new Texture2D(Cell, Cell, TextureFormat.RGBA32, false);
                var border = Color.Lerp(color, Color.black, 0.45f);
                for (var y = 0; y < Cell; y++)
                for (var x = 0; x < Cell; x++)
                    tex.SetPixel(x, y, x == 0 || y == 0 || x == Cell - 1 || y == Cell - 1 ? border : color);
                File.WriteAllBytes(path, tex.EncodeToPNG());
                UnityEngine.Object.DestroyImmediate(tex);
                AssetDatabase.ImportAsset(path);
                var importer = (TextureImporter)AssetImporter.GetAtPath(path);
                importer.textureType = TextureImporterType.Sprite;
                importer.spritePixelsPerUnit = Cell;
                importer.filterMode = FilterMode.Point;
                importer.mipmapEnabled = false;
                importer.textureCompression = TextureImporterCompression.Uncompressed;
                importer.SaveAndReimport();
            }
            return AssetDatabase.LoadAssetAtPath<Sprite>(path);
        }
    }
}
