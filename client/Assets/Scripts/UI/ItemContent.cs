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
        /// <summary>Per id: the 128 image (sprite) and the optional 32 icon (small, null when the server sent none).</summary>
        static readonly Dictionary<string, (string hash, Sprite sprite, Sprite small)> art = new Dictionary<string, (string, Sprite, Sprite)>();
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

        /// <summary>The item's Tier from the admin panel ("" for stacks), null when the server does not list it.</summary>
        public static string Tier(string defId) =>
            !string.IsNullOrEmpty(defId) && items.TryGetValue(defId, out var it) ? it.tier : null;

        /// <summary>The set the item belongs to, null when it has none or the server does not list it.</summary>
        public static string SetOf(string defId) =>
            !string.IsNullOrEmpty(defId) && items.TryGetValue(defId, out var it) && !string.IsNullOrEmpty(it.setId) ? it.setId : null;

        /// <summary>The set's name (a book page is named after its set), null when unknown.</summary>
        public static string SetName(string setId) =>
            !string.IsNullOrEmpty(setId) && sets.TryGetValue(setId, out var s) && !string.IsNullOrEmpty(s.name) ? s.name : null;

        /// <summary>How many book pages the game has right now; 0 until the server answered.</summary>
        public static int PageCount => pages.Length;

        /// <summary>The server's image of the item, null when it has none (the placeholder is drawn then).</summary>
        public static Sprite Icon(string defId) =>
            !string.IsNullOrEmpty(defId) && art.TryGetValue(defId, out var a) && a.sprite != null ? a.sprite : null;

        /// <summary>
        /// The server's 32x32 icon for slots and items on the ground; the 128 image when the item has no icon,
        /// null when it has no image at all.
        /// </summary>
        public static Sprite SmallIcon(string defId) =>
            !string.IsNullOrEmpty(defId) && art.TryGetValue(defId, out var a) ? (a.small != null ? a.small : a.sprite) : null;

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
                    if (string.IsNullOrEmpty(it.art))
                    {
                        if (art.TryGetValue(it.id, out var gone)) Release(gone.sprite, gone.small);
                        art.Remove(it.id);
                        continue;
                    }
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
                        var small = MakeSprite(e.icon); // null for older images without an icon
                        if (small != null) small.name = "item " + e.id + " icon";
                        if (art.TryGetValue(e.id, out var old)) Release(old.sprite, old.small);
                        art[e.id] = (e.hash, sprite, small);
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

        static void Release(params Sprite[] sprites)
        {
            foreach (var s in sprites)
            {
                if (s == null) continue;
                UnityEngine.Object.Destroy(s.texture);
                UnityEngine.Object.Destroy(s);
            }
        }

        /// <summary>PNG (base64, 128 or 32 px) → sprite, Point filter, one world unit wide like the placeholder icons.</summary>
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
