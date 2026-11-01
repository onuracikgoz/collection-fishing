// Collision data of the first map. Written by CollectionGame > Map > Export; do not edit by hand.
// The same export writes server/src/data/lake-map.ts. Until the map prefab exists this holds the
// starting values (the code-drawn test map).
using UnityEngine;

namespace CollectionGame.World
{
    public static partial class LakeMap
    {
        public const int Width = 128;
        public const int Height = 96;
        public static readonly Vector2 Spawn = new Vector2(64.5f, 50.5f);

        /// <summary>Fishable water; also blocked.</summary>
        public static readonly RectInt[] Water =
        {
            new RectInt(76, 30, 40, 17),
            new RectInt(76, 49, 40, 18),
            new RectInt(86, 47, 30, 2), // water past the pier's end
        };

        /// <summary>Everything nobody can stand on: the water above and the other blocked tiles.</summary>
        public static readonly RectInt[] Blocked =
        {
            new RectInt(63, 47, 3, 2), // fountain
            new RectInt(59, 39, 3, 2), // windmill
            new RectInt(76, 30, 40, 17),
            new RectInt(76, 49, 40, 18),
            new RectInt(86, 47, 30, 2),
        };

        /// <summary>Fingerprint of the map prefab's water / blocked / spawn markers at export time; 0 = never exported.</summary>
        public const int MarkerHash = 0;
    }
}
