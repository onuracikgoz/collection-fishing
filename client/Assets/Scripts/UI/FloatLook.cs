using System;
using System.Collections.Generic;
using CollectionGame.Economy;
using CollectionGame.Net;
using UnityEngine;
using UnityEngine.UI;

namespace CollectionGame.UI
{
    /// <summary>
    /// Float shows on the item's picture (01.11.2026, Onur, option B; docs/tasarim/05-esya-float.md 7.5):
    /// a worse Float is duller and muddier, Damaged also scratched; Pristine is brighter with sparkles
    /// around it, and Pristine / Excellent get a light streak that sweeps over the picture now and then.
    ///
    /// No shader: the look is painted once per copy into a new texture (Point filter, on the picture's own
    /// pixel grid, so it stays sharp), cached, and the streak is a few pre-painted frames that
    /// <see cref="FloatShine"/> plays. The condition comes from the catalog's bands (get_catalog), so the
    /// thresholds stay server data; with no catalog yet the plain picture shows. Purely visual: the server
    /// never sees it. The dirt pattern is seeded by the copy's instance id, so two Worn copies differ a little
    /// but one copy always looks the same.
    /// </summary>
    public static class FloatLook
    {
        /// <summary>The catalog (set by WorldController); null until get_catalog answered.</summary>
        public static Func<Prices> PricesSource;

        /// <summary>How each condition looks; t is the position inside the band (0 = band's best end).</summary>
        struct Style
        {
            public float sat, val;     // colour: saturation and brightness multipliers
            public float dirt;         // share of cells turned to mud (more at the bottom)
            public int scratches;      // light scratch lines
            public bool sparkles;      // little stars in the empty space around the item
            public float shinePeriod;  // seconds between light streaks, 0 = none
        }

        static Style StyleOf(string condition, float t)
        {
            switch (condition)
            {
                case "pristine": return new Style { sat = 1.12f, val = 1.06f, sparkles = true, shinePeriod = 2.6f };
                case "excellent": return new Style { sat = 1.06f, val = 1.03f, shinePeriod = 5f };
                case "worn": return new Style { sat = Mathf.Lerp(0.88f, 0.76f, t), val = Mathf.Lerp(0.95f, 0.9f, t), dirt = Mathf.Lerp(0.04f, 0.09f, t) };
                case "damaged":
                    return new Style
                    {
                        sat = Mathf.Lerp(0.7f, 0.55f, t), val = Mathf.Lerp(0.88f, 0.8f, t), dirt = Mathf.Lerp(0.12f, 0.2f, t),
                        scratches = t < 0.5f ? 2 : 3,
                    };
                default: return new Style { sat = 1f, val = 1f }; // normal: the picture as drawn
            }
        }

        /// <summary>Mud and dust from the game palette (content/palette.hex).</summary>
        static readonly Color[] Mud = { new Color32(0x4c, 0x3e, 0x24, 0xff), new Color32(0x67, 0x66, 0x33, 0xff), new Color32(0x96, 0x6c, 0x6c, 0xff), new Color32(0xab, 0x94, 0x7a, 0xff) };
        static readonly Color SparkCore = Color.white, SparkArm = new Color32(0xfb, 0xff, 0x86, 0xff);

        /// <summary>Frames of one light streak; it crosses the picture in <see cref="FloatShine.Sweep"/> seconds.</summary>
        const int ShineFrames = 10;

        sealed class Entry
        {
            /// <summary>The picture it was painted from; a new upload (admin panel) paints again.</summary>
            public Sprite from;
            public Sprite look;
            public Sprite[] shine;
            public float period, phase;
        }

        static readonly Dictionary<string, Entry> cache = new Dictionary<string, Entry>();

        [RuntimeInitializeOnLoadMethod(RuntimeInitializeLoadType.SubsystemRegistration)]
        static void ResetStatics()
        {
            cache.Clear();
            PricesSource = null;
        }

        /// <summary>Shows a copy on an Image: its picture with the Float look, the streak if it has one.</summary>
        public static void Apply(Image img, ItemInstance it)
        {
            if (img == null) return;
            if (it == null)
            {
                Clear(img);
                return;
            }
            var baseSprite = ItemIcons.For(it.defId);
            var e = Get(it, baseSprite);
            img.sprite = e?.look != null ? e.look : baseSprite;
            img.enabled = img.sprite != null;
            var shine = img.GetComponent<FloatShine>();
            if (e?.shine != null)
            {
                if (shine == null) shine = img.gameObject.AddComponent<FloatShine>();
                shine.Play(img, e.look, e.shine, e.period, e.phase);
            }
            else if (shine != null) shine.Stop();
        }

        /// <summary>Stops a streak on an Image that is about to show something else (a stack, an empty slot).</summary>
        public static void Clear(Image img)
        {
            if (img == null) return;
            var shine = img.GetComponent<FloatShine>();
            if (shine != null) shine.Stop();
        }

        /// <summary>The condition and the position inside its band, from the catalog; null without a catalog.</summary>
        static (string condition, float t)? Band(float f)
        {
            var bands = PricesSource?.Invoke()?.Catalog?.conditions;
            if (bands == null || bands.Length == 0) return null;
            CatalogCondition hit = bands[bands.Length - 1];
            foreach (var b in bands)
                if (f >= b.min && f < b.max)
                {
                    hit = b;
                    break;
                }
            var span = hit.max - hit.min;
            return (hit.condition, span > 0 ? Mathf.Clamp01((f - hit.min) / span) : 0f);
        }

        static Entry Get(ItemInstance it, Sprite baseSprite)
        {
            if (baseSprite == null) return null;
            var band = Band(it.@float);
            if (band == null) return null;
            var (condition, t) = band.Value;
            var seedKey = string.IsNullOrEmpty(it.instanceId) ? it.defId + "@" + it.@float.ToString("0.0000", System.Globalization.CultureInfo.InvariantCulture) : it.instanceId;
            var key = seedKey + "|" + condition + "|" + Mathf.RoundToInt(t * 20);
            if (cache.TryGetValue(key, out var e) && e.from == baseSprite) return e;
            e = Paint(baseSprite, StyleOf(condition, t), Hash(seedKey));
            e.from = baseSprite;
            cache[key] = e;
            return e;
        }

        static Entry Paint(Sprite src, Style st, int seed)
        {
            var e = new Entry();
            var tex = src.texture;
            if (tex == null || !tex.isReadable) return e; // plain picture
            var r = src.textureRect;
            int x0 = Mathf.RoundToInt(r.x), y0 = Mathf.RoundToInt(r.y), w = Mathf.RoundToInt(r.width), h = Mathf.RoundToInt(r.height);
            if (w <= 0 || h <= 0) return e;
            var px = tex.GetPixels(x0, y0, w, h);

            // colour
            if (!Mathf.Approximately(st.sat, 1f) || !Mathf.Approximately(st.val, 1f))
                for (var i = 0; i < px.Length; i++)
                {
                    var c = px[i];
                    if (c.a <= 0f) continue;
                    Color.RGBToHSV(c, out var hh, out var s, out var v);
                    var n = Color.HSVToRGB(hh, Mathf.Clamp01(s * st.sat), Mathf.Clamp01(v * st.val));
                    n.a = c.a;
                    px[i] = n;
                }

            // the effects work on cells of b x b pixels: a 128 px picture shows in a 32 unit bag slot,
            // so one cell is one screen pixel there and stays visible (and sharp) at any size
            var b = Mathf.Max(1, w / 32);
            int gw = w / b, gh = h / b;
            var rng = new System.Random(seed);

            if (st.dirt > 0f)
                for (var cy = 0; cy < gh; cy++)
                for (var cx = 0; cx < gw; cx++)
                {
                    if (!Solid(px, w, b, cx, cy)) continue;
                    var low = 1f - (cy + 0.5f) / gh; // y grows upwards: mud gathers at the bottom
                    var chance = st.dirt * (0.35f + 1.65f * low * low);
                    if (rng.NextDouble() < chance) FillCell(px, w, b, cx, cy, Mud[rng.Next(Mud.Length)], 0.85f);
                }

            for (var k = 0; k < st.scratches; k++)
            {
                int sx = rng.Next(gw / 5, gw * 4 / 5), sy = rng.Next(gh / 5, gh * 4 / 5);
                var dy = rng.Next(2) == 0 ? 1 : -1;
                var len = rng.Next(4, 8);
                for (var i = 0; i < len; i++)
                {
                    int cx = sx + i, cy = sy + dy * (i / 2);
                    if (cx >= gw || cy < 0 || cy >= gh || !Solid(px, w, b, cx, cy)) continue;
                    var c = px[(cy * b) * w + cx * b];
                    Color.RGBToHSV(c, out var hh, out var s, out var v);
                    FillCell(px, w, b, cx, cy, Color.HSVToRGB(hh, s * 0.35f, Mathf.Clamp01(v * 1.45f + 0.1f)), 1f);
                }
            }

            if (st.sparkles)
            {
                var spots = new[] { (0.14f, 0.8f), (0.86f, 0.86f), (0.88f, 0.16f), (0.12f, 0.2f) };
                foreach (var (fx, fy) in spots)
                {
                    int cx = Mathf.RoundToInt(fx * (gw - 1)), cy = Mathf.RoundToInt(fy * (gh - 1));
                    if (!EmptyAround(px, w, b, gw, gh, cx, cy)) continue;
                    FillCell(px, w, b, cx, cy, SparkCore, 1f);
                    FillCell(px, w, b, cx - 1, cy, SparkArm, 1f);
                    FillCell(px, w, b, cx + 1, cy, SparkArm, 1f);
                    FillCell(px, w, b, cx, cy - 1, SparkArm, 1f);
                    FillCell(px, w, b, cx, cy + 1, SparkArm, 1f);
                }
            }

            e.look = MakeSprite(px, w, h, src);
            if (st.shinePeriod > 0f)
            {
                e.period = st.shinePeriod;
                e.phase = (seed & 0x7fffffff) % 1000 / 1000f * st.shinePeriod; // copies do not flash together
                e.shine = new Sprite[ShineFrames];
                var frame = new Color[px.Length];
                for (var f = 0; f < ShineFrames; f++)
                {
                    Array.Copy(px, frame, px.Length);
                    // a 3 cell band along x + y, from the bottom-left corner to the top-right one
                    var pos = Mathf.RoundToInt(Mathf.Lerp(-3, gw + gh, (f + 0.5f) / ShineFrames));
                    for (var cy = 0; cy < gh; cy++)
                    for (var cx = 0; cx < gw; cx++)
                    {
                        var d = cx + cy - pos;
                        if (d < 0 || d > 2 || !Solid(frame, w, b, cx, cy)) continue;
                        TintCell(frame, w, b, cx, cy, Color.white, d == 1 ? 0.8f : 0.5f);
                    }
                    e.shine[f] = MakeSprite(frame, w, h, src);
                }
            }
            return e;
        }

        /// <summary>An opaque cell of the item that is not outline (the dark ink lines stay clean).</summary>
        static bool Solid(Color[] px, int w, int b, int cx, int cy)
        {
            var c = px[(cy * b + b / 2) * w + cx * b + b / 2];
            if (c.a < 0.5f) return false;
            return c.r * 0.3f + c.g * 0.59f + c.b * 0.11f > 0.2f;
        }

        static bool EmptyAround(Color[] px, int w, int b, int gw, int gh, int cx, int cy)
        {
            for (var y = cy - 1; y <= cy + 1; y++)
            for (var x = cx - 1; x <= cx + 1; x++)
            {
                if (x < 0 || y < 0 || x >= gw || y >= gh) return false;
                if (px[(y * b + b / 2) * w + x * b + b / 2].a > 0.05f) return false;
            }
            return true;
        }

        static void FillCell(Color[] px, int w, int b, int cx, int cy, Color c, float amount)
        {
            if (cx < 0 || cy < 0 || (cx + 1) * b > w || (cy + 1) * b * w > px.Length) return;
            for (var y = cy * b; y < (cy + 1) * b; y++)
            for (var x = cx * b; x < (cx + 1) * b; x++)
            {
                var i = y * w + x;
                var o = px[i];
                var n = o.a > 0f ? Color.Lerp(o, c, amount) : c;
                n.a = o.a > 0f ? o.a : 1f;
                px[i] = n;
            }
        }

        static void TintCell(Color[] px, int w, int b, int cx, int cy, Color c, float amount)
        {
            for (var y = cy * b; y < (cy + 1) * b; y++)
            for (var x = cx * b; x < (cx + 1) * b; x++)
            {
                var i = y * w + x;
                var o = px[i];
                if (o.a <= 0f) continue;
                var n = Color.Lerp(o, c, amount);
                n.a = o.a;
                px[i] = n;
            }
        }

        static Sprite MakeSprite(Color[] px, int w, int h, Sprite src)
        {
            var tex = new Texture2D(w, h, TextureFormat.RGBA32, false) { filterMode = FilterMode.Point, wrapMode = TextureWrapMode.Clamp };
            tex.SetPixels(px);
            tex.Apply(false, true); // the GPU copy is enough, keep no CPU copy
            var pivot = new Vector2(src.pivot.x / w, src.pivot.y / h);
            var s = Sprite.Create(tex, new Rect(0, 0, w, h), pivot, src.pixelsPerUnit);
            s.name = src.name + " float";
            return s;
        }

        static int Hash(string s)
        {
            unchecked
            {
                var h = 2166136261u;
                foreach (var ch in s)
                {
                    h ^= ch;
                    h *= 16777619u;
                }
                return (int)h;
            }
        }
    }
}
