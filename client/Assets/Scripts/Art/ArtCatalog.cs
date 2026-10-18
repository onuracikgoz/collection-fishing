using System;
using System.Collections.Generic;
using UnityEngine;

namespace CollectionGame.Art
{
    /// <summary>
    /// Every texture under Assets/Art/LPC/, by path relative to that folder
    /// (e.g. "Terrain/terrain_summer.png"). The editor keeps
    /// Assets/Resources/ArtCatalog.asset up to date (ArtCatalogBuilder), so
    /// runtime code can build sprites and tiles without scene references.
    /// </summary>
    public class ArtCatalog : ScriptableObject
    {
        public const string Root = "Assets/Art/LPC/";
        public const string ResourceName = "ArtCatalog";

        [Serializable]
        public struct Entry
        {
            public string path;
            public Texture2D texture;
        }

        public List<Entry> entries = new List<Entry>();

        static Dictionary<string, Texture2D> byPath;
        static readonly Dictionary<(Texture2D, RectInt, float, float), Sprite> sprites = new Dictionary<(Texture2D, RectInt, float, float), Sprite>();

        public static Texture2D Texture(string path)
        {
            if (byPath == null)
            {
                byPath = new Dictionary<string, Texture2D>();
                var catalog = Resources.Load<ArtCatalog>(ResourceName);
                if (catalog != null)
                    foreach (var e in catalog.entries)
                        if (e.texture != null) byPath[e.path] = e.texture;
            }
            if (byPath.TryGetValue(path, out var tex)) return tex;
#if UNITY_EDITOR
            // Catalog not refreshed yet (new file): read straight from the project.
            tex = UnityEditor.AssetDatabase.LoadAssetAtPath<Texture2D>(Root + path);
            if (tex != null)
            {
                byPath[path] = tex;
                return tex;
            }
#endif
            Debug.LogError($"[Art] Missing texture: {Root}{path}");
            return null;
        }

        /// <summary>
        /// A sprite cut from a texture. <paramref name="rect"/> is in pixels with the
        /// origin at the TOP-left, as image editors show it. Pivot is (0..1) of the rect.
        /// </summary>
        public static Sprite Sprite(string path, RectInt rect, float pivotX = 0.5f, float pivotY = 0.5f)
        {
            var tex = Texture(path);
            if (tex == null) return null;
            var key = (tex, rect, pivotX, pivotY);
            if (sprites.TryGetValue(key, out var sprite)) return sprite;
            var unityRect = new Rect(rect.x, tex.height - rect.y - rect.height, rect.width, rect.height);
            sprite = UnityEngine.Sprite.Create(tex, unityRect, new Vector2(pivotX, pivotY), PixelsPerUnit, 0, SpriteMeshType.FullRect);
            sprite.name = $"{path}@{rect.x},{rect.y}";
            sprites[key] = sprite;
            return sprite;
        }

        /// <summary>Same as the import setting in PixelArtImporter: one 32 px tile = one unit.</summary>
        public const float PixelsPerUnit = 32f;
    }
}
