using CollectionGame.Art;
using CollectionGame.Net;
using UnityEngine;
using UnityEngine.Rendering;

namespace CollectionGame.World
{
    /// <summary>
    /// One character on screen: LPC layers stacked in a SortingGroup, Walk / Idle
    /// animation in four directions, plus the name and chat bubble that
    /// <see cref="WorldController"/> draws above the head.
    ///
    /// LPC Revised sheets: 64×64 frames, rows top to bottom = up, left, down, right
    /// (row 3 is row 1 mirrored). Walk has 8 frames, Idle 3. Feet are at the
    /// bottom of the frame (2 px margin), so the pivot sits there.
    /// </summary>
    public class CharacterView : MonoBehaviour
    {
        const int Frame = 64;
        const float WalkFps = 10f;
        const float IdleFps = 3f;
        const float FeetPivot = 2f / Frame;

        SpriteRenderer[] layers;
        SortingGroup group;
        Appearance look;
        float animTime;
        bool wasMoving;

        public string Id { get; private set; }
        public string DisplayName { get; set; }
        public string Bubble { get; private set; }
        public float BubbleUntil { get; private set; }
        public Vector2 ServerPos { get; private set; }
        public string Facing { get; private set; } = Dir.Down;
        public bool Moving { get; private set; }

        public static CharacterView Create(Transform parent, string id, string name)
        {
            var go = new GameObject($"Player {name}");
            go.transform.SetParent(parent, false);
            var view = go.AddComponent<CharacterView>();
            view.DisplayName = name;
            view.Id = id;
            view.look = Appearance.For(id);
            view.group = go.AddComponent<SortingGroup>();
            var paths = view.look.LayerPaths;
            view.layers = new SpriteRenderer[paths.Length];
            for (var i = 0; i < paths.Length; i++)
            {
                var layer = new GameObject(paths[i]);
                layer.transform.SetParent(go.transform, false);
                view.layers[i] = layer.AddComponent<SpriteRenderer>();
                view.layers[i].sortingOrder = i;
            }
            return view;
        }

        /// <summary>Sprites lower on screen (bigger server y) draw in front.</summary>
        public static int SortingOrderFor(float serverY) => Mathf.RoundToInt(serverY * 16f);

        public void SetState(Vector2 serverPos, string facing, bool moving)
        {
            ServerPos = serverPos;
            if (!string.IsNullOrEmpty(facing)) Facing = facing;
            Moving = moving;
            transform.position = Coords.ToUnity(serverPos);
            group.sortingOrder = SortingOrderFor(serverPos.y);
        }

        public void Say(string text, float seconds)
        {
            Bubble = text;
            BubbleUntil = Time.time + seconds;
        }

        void Update()
        {
            if (Moving != wasMoving)
            {
                animTime = 0f;
                wasMoving = Moving;
            }
            animTime += Time.deltaTime;

            var anim = Moving ? "Walk" : "Idle";
            var frames = Moving ? 8 : 3;
            var frame = (int)(animTime * (Moving ? WalkFps : IdleFps)) % frames;
            var row = Row(Facing);
            var rect = new RectInt(frame * Frame, row * Frame, Frame, Frame);
            var paths = look.LayerPaths;
            for (var i = 0; i < layers.Length; i++)
                layers[i].sprite = ArtCatalog.Sprite(string.Format(paths[i], anim), rect, 0.5f, FeetPivot);
        }

        static int Row(string dir)
        {
            switch (dir)
            {
                case Dir.Up: return 0;
                case Dir.Left: return 1;
                case Dir.Right: return 3;
                default: return 2;
            }
        }
    }

    /// <summary>
    /// Which LPC parts a character wears. Phase 1 has only characterId "default";
    /// until characters are saved on the server, the look is picked from the
    /// player id so two testers can tell each other apart. Client-side only.
    /// </summary>
    public readonly struct Appearance
    {
        static readonly string[] Skins = { "Peach", "Tan", "Brown" };
        static readonly string[] HairStyles = { "Short 02 - Parted", "Medium 07 - Bob, Side Part" };
        static readonly string[] HairColors = { "Brown", "Black", "Blonde" };
        static readonly string[] Shirts = { "Blue", "Red", "White" };
        static readonly string[] Pants = { "Denim", "Brown" };

        /// <summary>Bottom to top; "{0}" is the animation name (Walk, Idle).</summary>
        public readonly string[] LayerPaths;

        Appearance(string[] layerPaths) => LayerPaths = layerPaths;

        public static Appearance For(string id)
        {
            var h = StableHash(id ?? "");
            int Pick(int count)
            {
                var v = (int)(h % (uint)count);
                h /= (uint)count;
                return v;
            }

            var feminine = Pick(2) == 0;
            var skin = Skins[Pick(Skins.Length)];
            var hair = HairStyles[Pick(HairStyles.Length)];
            var hairColor = HairColors[Pick(HairColors.Length)];
            var shirt = Shirts[Pick(Shirts.Length)];
            var pants = Pants[Pick(Pants.Length)];

            var body = feminine ? "Body 01 - Feminine, Thin" : "Body 02 - Masculine, Thin";
            var clothes = feminine ? "Feminine, Thin" : "Masculine, Thin";
            var head = feminine ? "Head 01 - Feminine" : "Head 02 - Masculine";
            return new Appearance(new[]
            {
                $"Characters/Body/{body}/{skin}/{{0}}.png",
                $"Characters/Clothing/{clothes}/Feet/Shoes 01 - Shoes/Brown/{{0}}.png",
                $"Characters/Clothing/{clothes}/Legs/Pants 03 - Pants/{pants}/{{0}}.png",
                $"Characters/Clothing/{clothes}/Torso/Shirt 04 - T-shirt/{shirt}/{{0}}.png",
                $"Characters/Head/{head}/{skin}/{{0}}.png",
                $"Characters/Hair/{hair}/{hairColor}/{{0}}.png",
            });
        }

        // string.GetHashCode is randomized per process; this one is the same everywhere.
        static uint StableHash(string s)
        {
            unchecked
            {
                var h = 2166136261u;
                foreach (var c in s) h = (h ^ c) * 16777619u;
                return h;
            }
        }
    }
}
