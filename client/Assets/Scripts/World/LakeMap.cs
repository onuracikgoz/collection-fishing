using UnityEngine;

namespace CollectionGame.World
{
    /// <summary>
    /// Client copy of server/src/data/lake-map.ts and the collision checks in
    /// server/src/rules/map.ts. Both sides must agree or the player gets CORRECTIONs.
    /// Temporary: later both should be generated from the Unity tilemap.
    ///
    /// Coordinates are server tiles: x grows right, y grows DOWN (row 0 is the
    /// north edge). <see cref="Coords"/> converts to Unity world space.
    /// </summary>
    public static class LakeMap
    {
        public const int Width = 128;
        public const int Height = 96;
        public static readonly Vector2 Spawn = new Vector2(64.5f, 50.5f);

        public static readonly RectInt Fountain = new RectInt(63, 47, 3, 2);

        /// <summary>Fishable water (server LAKE_WATER); also blocked.</summary>
        public static readonly RectInt[] Water =
        {
            new RectInt(76, 30, 40, 17),
            new RectInt(76, 49, 40, 18),
            new RectInt(86, 47, 30, 2), // water past the pier's end
        };

        public static readonly RectInt[] Blocked = { Fountain, Water[0], Water[1], Water[2] };

        // Drawing only (not collision): the lake's water and the walkable pier through it.
        public static readonly RectInt Lake = new RectInt(76, 30, 40, 37);
        public static readonly RectInt Pier = new RectInt(76, 47, 10, 2);

        static bool[] cells;

        static bool[] Cells
        {
            get
            {
                if (cells != null) return cells;
                cells = new bool[Width * Height];
                foreach (var r in Blocked)
                    for (var y = Mathf.Max(0, r.y); y < Mathf.Min(Height, r.y + r.height); y++)
                    for (var x = Mathf.Max(0, r.x); x < Mathf.Min(Width, r.x + r.width); x++)
                        cells[y * Width + x] = true;
                return cells;
            }
        }

        public static bool IsBlockedTile(int x, int y) =>
            x < 0 || y < 0 || x >= Width || y >= Height || Cells[y * Width + x];

        public static bool IsWalkable(Vector2 p)
        {
            if (!(p.x >= 0 && p.y >= 0 && p.x < Width && p.y < Height)) return false;
            return !Cells[Mathf.FloorToInt(p.y) * Width + Mathf.FloorToInt(p.x)];
        }

        public static bool IsWater(Vector2 p)
        {
            var t = new Vector2Int(Mathf.FloorToInt(p.x), Mathf.FloorToInt(p.y));
            foreach (var r in Water)
                if (r.Contains(t)) return true;
            return false;
        }

        /// <summary>Same test as the server's isNearWater: some water tile within reach of the point.</summary>
        public static bool IsNearWater(Vector2 p, float reach)
        {
            for (var ty = Mathf.FloorToInt(p.y - reach); ty <= Mathf.FloorToInt(p.y + reach); ty++)
            for (var tx = Mathf.FloorToInt(p.x - reach); tx <= Mathf.FloorToInt(p.x + reach); tx++)
            {
                if (!IsWater(new Vector2(tx + 0.5f, ty + 0.5f))) continue;
                var dx = Mathf.Max(tx - p.x, 0f, p.x - (tx + 1));
                var dy = Mathf.Max(ty - p.y, 0f, p.y - (ty + 1));
                if (dx * dx + dy * dy <= reach * reach) return true;
            }
            return false;
        }

        const float Step = 0.25f; // same sampling as the server

        public static bool IsPathClear(Vector2 a, Vector2 b)
        {
            var steps = Mathf.Max(1, Mathf.CeilToInt(Vector2.Distance(a, b) / Step));
            for (var i = 1; i <= steps; i++)
                if (!IsWalkable(Vector2.Lerp(a, b, (float)i / steps))) return false;
            return true;
        }
    }

    /// <summary>
    /// Server tiles ↔ Unity world. 1 tile = 1 Unity unit (32 px at 32 PPU).
    /// Unity y = -server y, so the map spans x 0..128, y 0..-96, and server tile
    /// (col, row) is tilemap cell (col, -row - 1).
    /// </summary>
    public static class Coords
    {
        public static Vector3 ToUnity(Vector2 server, float z = 0f) => new Vector3(server.x, -server.y, z);
        public static Vector2 ToServer(Vector3 unity) => new Vector2(unity.x, -unity.y);
        public static Vector3Int Cell(int col, int row) => new Vector3Int(col, -row - 1, 0);
    }
}
