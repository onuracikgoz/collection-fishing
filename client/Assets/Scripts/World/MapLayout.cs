using UnityEngine;
using UnityEngine.Tilemaps;

namespace CollectionGame.World
{
    /// <summary>
    /// The map prefab that the map editor builds (Assets/Resources/Map/Lake.prefab) and the names
    /// inside it. Tilemap layers, drawn bottom to top:
    ///   Ground  the floor (grass, dirt, water)         Detail  flat things on the floor (roads, planks, flowers)
    ///   Above   drawn over the characters (tree tops, roofs)
    /// Markers, drawn only while editing and used for the server's collision:
    ///   Water   fishable water (also blocked)          Blocked  tiles nobody can stand on
    ///   Spawn   an object: where new players appear
    /// Free objects (trees, houses) go under "Objects" with a MapObject component.
    /// </summary>
    public static class MapLayout
    {
        public const string ResourcePath = "Map/Lake";
        public const string Ground = "Ground", Detail = "Detail", Above = "Above";
        public const string Water = "Water", Blocked = "Blocked", Spawn = "Spawn", Objects = "Objects";

        public const int GroundOrder = -30000;
        public const int DetailOrder = -29999;
        public const int AboveOrder = 30000;

        public static GameObject Load() => Resources.Load<GameObject>(ResourcePath);

        public static Tilemap Layer(GameObject root, string name)
        {
            var t = root.transform.Find(name);
            return t != null ? t.GetComponent<Tilemap>() : null;
        }

        /// <summary>Server tile (col, row) of a tilemap cell; row 0 is the north edge.</summary>
        public static Vector2Int ToTile(Vector3Int cell) => new Vector2Int(cell.x, -cell.y - 1);

        /// <summary>
        /// Fingerprint of the markers: which tiles are water, which are blocked, and the spawn tile.
        /// The exporter stores it in LakeMapData.cs; a different value at play time means the prefab was
        /// edited and not exported.
        /// </summary>
        public static int MarkerHash(GameObject root)
        {
            var water = Layer(root, Water);
            var blocked = Layer(root, Blocked);
            var spawn = root.transform.Find(Spawn);
            unchecked
            {
                var h = 17;
                for (var row = 0; row < LakeMap.Height; row++)
                for (var col = 0; col < LakeMap.Width; col++)
                {
                    var cell = new Vector3Int(col, -row - 1, 0);
                    var kind = water != null && water.HasTile(cell) ? 1 : blocked != null && blocked.HasTile(cell) ? 2 : 0;
                    if (kind != 0) h = h * 31 + (row * LakeMap.Width + col) * 3 + kind;
                }
                if (spawn != null) h = h * 31 + Mathf.FloorToInt(spawn.position.x) * 1000 + Mathf.FloorToInt(-spawn.position.y);
                return h == 0 ? 1 : h;
            }
        }
    }
}
