// Collision data of the first map. Written by CollectionGame > Map > Export; do not edit by hand.
// The same export writes server/src/data/lake-map.ts. Until the map prefab exists this holds the
// starting values (the code-drawn test map); the café and fishing shop rows (16.11.2026) and the Gemini map art
// rows (21.11.2026) were added by hand to match content/maps/lake.json.
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
            new RectInt(62, 47, 5, 2), // fountain (Gemini)
            new RectInt(59, 39, 3, 2), // windmill (Gemini)
            new RectInt(59, 21, 4, 1), // market board
            new RectInt(55, 47, 1, 1), // signpost
            new RectInt(56, 42, 1, 1), // street lamp
            new RectInt(56, 55, 1, 1), // street lamp
            new RectInt(73, 55, 1, 1), // street lamp
            new RectInt(75, 46, 1, 1), // pier lantern
            new RectInt(26, 75, 4, 2), // bank, west of the door
            new RectInt(31, 75, 4, 2), // bank, east of the door
            new RectInt(16, 75, 8, 2), // cottage
            new RectInt(38, 75, 8, 2), // two-storey house
            new RectInt(24, 82, 3, 1), // well
            new RectInt(67, 60, 8, 2), // workshop
            new RectInt(100, 71, 6, 2), // lake cottage
            new RectInt(10, 11, 6, 3), // cave
            new RectInt(39, 23, 2, 1), // campfire
            new RectInt(49, 9, 1, 1), // tree trunk
            new RectInt(57, 5, 1, 1), // tree trunk
            new RectInt(71, 11, 1, 1), // tree trunk
            new RectInt(43, 19, 1, 1), // tree trunk
            new RectInt(53, 15, 1, 1), // tree trunk
            new RectInt(69, 5, 1, 1), // tree trunk
            new RectInt(47, 3, 1, 1), // tree trunk
            new RectInt(75, 19, 1, 1), // tree trunk
            new RectInt(39, 9, 1, 1), // tree trunk
            new RectInt(5, 21, 1, 1), // tree trunk
            new RectInt(19, 7, 1, 1), // tree trunk
            new RectInt(59, 13, 1, 1), // tree trunk
            new RectInt(12, 85, 1, 1), // tree trunk
            new RectInt(46, 85, 1, 1), // tree trunk
            new RectInt(50, 61, 6, 2), // café, west of the door
            new RectInt(58, 61, 1, 2), // café, east of the door
            new RectInt(66, 40, 3, 2), // fishing shop, west of the door
            new RectInt(71, 40, 3, 2), // fishing shop, east of the door
            new RectInt(76, 30, 40, 17),
            new RectInt(76, 49, 40, 18),
            new RectInt(86, 47, 30, 2),
        };

        /// <summary>Fingerprint of the map prefab's water / blocked / spawn markers at export time; 0 = never exported.</summary>
        public const int MarkerHash = 0;
    }
}
