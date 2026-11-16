using System.Collections.Generic;
using CollectionGame.Art;
using CollectionGame.Net;
using UnityEngine;

namespace CollectionGame.Wardrobe
{
    /// <summary>
    /// A worn look (server <see cref="LookView"/>) as Universal LPC layers, bottom to top, and the
    /// frames the game plays. Sheets: 64×64 frames, rows up, left, down, right.
    /// walk: 9 frames, frame 0 standing, 1-8 the step cycle. idle: 2 frames. sit: 3 poses
    /// (0 on the ground, 2 on a chair). A layer without idle or sit shows walk's standing frame.
    /// </summary>
    public static class LpcLook
    {
        public const int Frame = 64;
        public const int WalkFrames = 8;
        public const int IdleFrames = 2;
        public const int ChairPose = 2;

        public enum Anim { Walk, Idle, Sit }

        public sealed class Layer
        {
            public int Z;
            public string PartId;
            public LpcManifest.SheetSet Sheets;
            public LpcManifest.ColorMap[] Maps;
            public string[] Colors;
        }

        /// <summary>Shown until the server sends a look (an older server, or before WELCOME).</summary>
        public static readonly LookView Fallback = new LookView
        {
            body = Bodies.Male,
            skin = "skin_peach",
            eyes = "eye_blue",
            parts = new[]
            {
                new LookPartView { part = "torso_clothes_tshirt", color = "dye_white" },
                new LookPartView { part = "legs_pants", color = "dye_navy" },
                new LookPartView { part = "feet_shoes_basic", color = "dye_brown" },
            },
        };

        public static string BodyOf(LookView look) => look != null && look.body == Bodies.Female ? Bodies.Female : Bodies.Male;

        public static List<Layer> Layers(LookView look)
        {
            if (look == null || !look.IsSet) look = Fallback;
            var body = BodyOf(look);
            var list = new List<(int order, Layer layer)>();
            void Add(string partId, params string[] colors)
            {
                var part = LpcManifest.PartById(partId);
                if (part?.layers == null) return;
                foreach (var l in part.layers)
                {
                    var sheets = LpcManifest.Sheets(l, body);
                    if (sheets == null || string.IsNullOrEmpty(sheets.walk)) continue;
                    list.Add((list.Count, new Layer { Z = l.z, PartId = partId, Sheets = sheets, Maps = part.maps, Colors = colors }));
                }
            }
            Add("body", look.skin);
            Add("head_" + body, look.skin, look.eyes);
            Add("face", look.skin, look.eyes);
            foreach (var p in look.parts ?? new LookPartView[0])
                if (p != null) Add(p.part, p.color ?? "", p.color2 ?? "");
            // Stable: same z keeps the order above (identity first, then parts as listed).
            list.Sort((a, b) => a.layer.Z != b.layer.Z ? a.layer.Z.CompareTo(b.layer.Z) : a.order.CompareTo(b.order));
            var layers = new List<Layer>(list.Count);
            foreach (var (_, l) in list) layers.Add(l);
            return layers;
        }

        /// <summary>Walk's standing frame (sheet frame 0): the wardrobe preview.</summary>
        public static Sprite Standing(Layer layer, int row, float pivotY)
        {
            var tex = LpcRecolor.Sheet(layer.Sheets.walk, layer.Maps, layer.Colors);
            return tex == null ? null : ArtCatalog.SpriteOf(tex, new RectInt(0, row * Frame, Frame, Frame), 0.5f, pivotY);
        }

        /// <summary>
        /// The sprite of one layer: <paramref name="frame"/> counts within the animation (walk's step
        /// cycle starts at sheet frame 1). Null when the layer has no sheet.
        /// </summary>
        public static Sprite Sprite(Layer layer, Anim anim, int frame, int row, float pivotY)
        {
            string path;
            int col;
            switch (anim)
            {
                case Anim.Idle:
                    path = layer.Sheets.idle;
                    col = frame % IdleFrames;
                    break;
                case Anim.Sit:
                    path = layer.Sheets.sit;
                    col = frame;
                    break;
                default:
                    path = layer.Sheets.walk;
                    col = 1 + frame % WalkFrames;
                    break;
            }
            if (string.IsNullOrEmpty(path))
            {
                path = layer.Sheets.walk;
                col = 0;
            }
            var tex = LpcRecolor.Sheet(path, layer.Maps, layer.Colors);
            if (tex == null) return null;
            if ((col + 1) * Frame > tex.width) col = 0;
            return ArtCatalog.SpriteOf(tex, new RectInt(col * Frame, row * Frame, Frame, Frame), 0.5f, pivotY);
        }

        static readonly Dictionary<string, Sprite> thumbs = new Dictionary<string, Sprite>();

        [RuntimeInitializeOnLoadMethod(RuntimeInitializeLoadType.SubsystemRegistration)]
        static void ResetStatics() => thumbs.Clear();

        /// <summary>
        /// One part alone, facing down, standing, cropped square around its pixels: the wardrobe's slot
        /// picture. Null when the part has no sheet for this body.
        /// </summary>
        public static Sprite Thumb(string partId, string body, string color, string color2)
        {
            var key = $"{partId}|{body}|{color}|{color2}";
            if (thumbs.TryGetValue(key, out var done)) return done;
            Sprite result = null;
            var part = LpcManifest.PartById(partId);
            if (part?.layers != null)
            {
                var px = new Color32[Frame * Frame];
                var any = false;
                var layers = new List<LpcManifest.Layer>(part.layers);
                layers.Sort((a, b) => a.z.CompareTo(b.z));
                foreach (var l in layers)
                {
                    var sheets = LpcManifest.Sheets(l, body);
                    var tex = sheets == null ? null : LpcRecolor.Sheet(sheets.walk, part.maps, new[] { color ?? "", color2 ?? "" });
                    if (tex == null || !tex.isReadable || tex.height < 3 * Frame) continue;
                    var block = tex.GetPixels32();
                    var y0 = tex.height - 3 * Frame; // row 2 (down) from the top, in Unity's bottom-up rows
                    for (var y = 0; y < Frame; y++)
                    for (var x = 0; x < Frame; x++)
                    {
                        var c = block[(y0 + y) * tex.width + x];
                        if (c.a == 0) continue;
                        px[y * Frame + x] = c.a == 255 ? c : Color32.Lerp(px[y * Frame + x], c, c.a / 255f);
                        any = true;
                    }
                }
                if (any) result = Cropped(px, key);
            }
            thumbs[key] = result;
            return result;
        }

        static Sprite Cropped(Color32[] px, string name)
        {
            int minX = Frame, minY = Frame, maxX = -1, maxY = -1;
            for (var y = 0; y < Frame; y++)
            for (var x = 0; x < Frame; x++)
                if (px[y * Frame + x].a > 0)
                {
                    minX = Mathf.Min(minX, x); maxX = Mathf.Max(maxX, x);
                    minY = Mathf.Min(minY, y); maxY = Mathf.Max(maxY, y);
                }
            var size = Mathf.Max(16, Mathf.Max(maxX - minX, maxY - minY) + 3);
            var cx = (minX + maxX + 1) / 2;
            var cy = (minY + maxY + 1) / 2;
            var tex = new Texture2D(size, size, TextureFormat.RGBA32, false) { filterMode = FilterMode.Point, wrapMode = TextureWrapMode.Clamp, name = name };
            var outPx = new Color32[size * size];
            for (var y = 0; y < size; y++)
            for (var x = 0; x < size; x++)
            {
                int sx = cx - size / 2 + x, sy = cy - size / 2 + y;
                if (sx >= 0 && sy >= 0 && sx < Frame && sy < Frame) outPx[y * size + x] = px[sy * Frame + sx];
            }
            tex.SetPixels32(outPx);
            tex.Apply(false, true);
            return UnityEngine.Sprite.Create(tex, new Rect(0, 0, size, size), new Vector2(0.5f, 0.5f), ArtCatalog.PixelsPerUnit, 0, SpriteMeshType.FullRect);
        }
    }
}
