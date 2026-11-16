using System.Collections.Generic;
using CollectionGame.Art;
using UnityEngine;

namespace CollectionGame.Wardrobe
{
    /// <summary>
    /// Recoloured copies of Universal LPC sheets: every pixel whose colour is in a part's map takes the
    /// same tone of the chosen colour's ramp (the way the LPC generator recolours, exact for sheets drawn
    /// in their base ramp). One copy per sheet and colour set, kept for the session.
    /// The sheets under Art/LPC/Universal are imported readable (PixelArtImporter).
    /// </summary>
    public static class LpcRecolor
    {
        static readonly Dictionary<string, Texture2D> cache = new Dictionary<string, Texture2D>();

        [RuntimeInitializeOnLoadMethod(RuntimeInitializeLoadType.SubsystemRegistration)]
        static void ResetStatics() => cache.Clear();

        static uint Key(Color32 c) => (uint)(c.r << 16 | c.g << 8 | c.b);

        /// <summary>
        /// The sheet at ArtCatalog <paramref name="path"/> in <paramref name="colors"/> (one colour id per
        /// map of the part; "" leaves that area as drawn). Null when the sheet is missing.
        /// </summary>
        public static Texture2D Sheet(string path, LpcManifest.ColorMap[] maps, string[] colors)
        {
            if (string.IsNullOrEmpty(path)) return null;
            var key = path + "|" + string.Join(",", colors ?? new string[0]);
            if (cache.TryGetValue(key, out var done) && done != null) return done;

            var src = ArtCatalog.Texture(path);
            if (src == null) return null;
            var lut = new Dictionary<uint, Color32>();
            if (maps != null && colors != null)
                for (var a = 0; a < maps.Length && a < colors.Length; a++)
                {
                    var ramp = LpcManifest.RampOf(colors[a]);
                    var map = maps[a];
                    if (ramp == null || map?.src == null) continue;
                    for (var i = 0; i < map.src.Length; i++)
                        lut[Key(LpcManifest.Hex(map.src[i]))] = ramp[Mathf.Clamp(map.tone[i], 0, ramp.Length - 1)];
                }
            if (lut.Count == 0)
            {
                cache[key] = src;
                return src;
            }
            if (!src.isReadable)
            {
                Debug.LogError($"[Wardrobe] {path} is not readable; reimport Assets/Art/LPC/Universal (PixelArtImporter)");
                cache[key] = src;
                return src;
            }
            var px = src.GetPixels32();
            for (var i = 0; i < px.Length; i++)
            {
                var p = px[i];
                if (p.a == 0) continue;
                if (lut.TryGetValue(Key(p), out var to)) px[i] = new Color32(to.r, to.g, to.b, p.a);
            }
            var tex = new Texture2D(src.width, src.height, TextureFormat.RGBA32, false)
            {
                filterMode = FilterMode.Point,
                wrapMode = TextureWrapMode.Clamp,
                name = key,
            };
            tex.SetPixels32(px);
            tex.Apply(false, false); // kept readable: wardrobe thumbnails read it (LpcLook.Thumb)
            cache[key] = tex;
            return tex;
        }
    }
}
