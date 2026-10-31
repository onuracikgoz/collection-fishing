using System;
using System.Collections.Generic;
using System.Threading.Tasks;
using CollectionGame.Net;
using UnityEngine;

namespace CollectionGame.UI
{
    /// <summary>
    /// Item names, set names and icons that come from the server (admin panel, docs/protokol.md İçerik):
    /// get_content once at login and on every server join, get_item_art for images whose hash is new.
    /// Items the server has no image for (the old placeholder items) keep the drawn placeholder icons
    /// (<see cref="ItemIcons"/>); everything here falls back to null so callers keep their old behaviour.
    /// </summary>
    public static class ItemContent
    {
        const int ArtBatch = 40;

        static readonly Dictionary<string, ContentItem> items = new Dictionary<string, ContentItem>();
        static readonly Dictionary<string, ContentSet> sets = new Dictionary<string, ContentSet>();
        static readonly Dictionary<string, (string hash, Sprite sprite)> art = new Dictionary<string, (string, Sprite)>();
        static string[] pages = Array.Empty<string>();
        static bool loading;

        [RuntimeInitializeOnLoadMethod(RuntimeInitializeLoadType.SubsystemRegistration)]
        static void ResetStatics()
        {
            items.Clear();
            sets.Clear();
            art.Clear();
            pages = Array.Empty<string>();
            loading = false;
        }

        /// <summary>The name the admin panel gave the item (or "Recipe: ..."), null when the server does not list it.</summary>
        public static string Name(string defId) =>
            !string.IsNullOrEmpty(defId) && items.TryGetValue(defId, out var it) && !string.IsNullOrEmpty(it.name) ? it.name : null;

        /// <summary>The set's name (a book page is named after its set), null when unknown.</summary>
        public static string SetName(string setId) =>
            !string.IsNullOrEmpty(setId) && sets.TryGetValue(setId, out var s) && !string.IsNullOrEmpty(s.name) ? s.name : null;

        /// <summary>How many book pages the game has right now; 0 until the server answered.</summary>
        public static int PageCount => pages.Length;

        /// <summary>The server's image of the item, null when it has none (the placeholder is drawn then).</summary>
        public static Sprite Icon(string defId) =>
            !string.IsNullOrEmpty(defId) && art.TryGetValue(defId, out var a) && a.sprite != null ? a.sprite : null;

        /// <summary>Loads names, sets and any new or changed images. Never throws; a failure keeps what is cached.</summary>
        public static async Task LoadAsync(Connection net)
        {
            if (loading) return;
            loading = true;
            try
            {
                var content = await net.GetContentAsync();
                if (content?.items == null) return;
                items.Clear();
                foreach (var it in content.items) items[it.id] = it;
                sets.Clear();
                foreach (var s in content.sets ?? Array.Empty<ContentSet>()) sets[s.id] = s;
                pages = content.pages ?? Array.Empty<string>();

                var need = new List<string>();
                foreach (var it in content.items)
                {
                    if (string.IsNullOrEmpty(it.art)) { art.Remove(it.id); continue; }
                    if (!art.TryGetValue(it.id, out var have) || have.hash != it.art || have.sprite == null) need.Add(it.id);
                }
                for (var i = 0; i < need.Count; i += ArtBatch)
                {
                    var batch = need.GetRange(i, Math.Min(ArtBatch, need.Count - i)).ToArray();
                    var res = await net.GetItemArtAsync(batch);
                    foreach (var e in res?.art ?? Array.Empty<ItemArtEntry>())
                    {
                        var sprite = MakeSprite(e.png);
                        if (sprite == null) continue;
                        sprite.name = "item " + e.id;
                        if (art.TryGetValue(e.id, out var old) && old.sprite != null)
                        {
                            UnityEngine.Object.Destroy(old.sprite.texture);
                            UnityEngine.Object.Destroy(old.sprite);
                        }
                        art[e.id] = (e.hash, sprite);
                    }
                }
            }
            catch (Exception e)
            {
                Debug.LogWarning($"[ItemContent] get_content failed: {e.Message}");
            }
            finally
            {
                loading = false;
            }
        }

        /// <summary>128x128 PNG (base64) → sprite, Point filter, one world unit wide like the placeholder icons.</summary>
        static Sprite MakeSprite(string base64)
        {
            if (string.IsNullOrEmpty(base64)) return null;
            try
            {
                var tex = new Texture2D(2, 2, TextureFormat.RGBA32, false) { filterMode = FilterMode.Point, wrapMode = TextureWrapMode.Clamp };
                if (!tex.LoadImage(Convert.FromBase64String(base64)))
                {
                    UnityEngine.Object.Destroy(tex);
                    return null;
                }
                return Sprite.Create(tex, new Rect(0, 0, tex.width, tex.height), new Vector2(0.5f, 0.5f), tex.width);
            }
            catch (FormatException)
            {
                return null;
            }
        }
    }
}
