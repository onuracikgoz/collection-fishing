using System.Collections.Generic;
using CollectionGame.Net;
using CollectionGame.UI;
using CollectionGame.UI.Views;
using UnityEngine;

namespace CollectionGame.World
{
    /// <summary>
    /// Fills the HUD mini map (31.10.2026, Onur): the tiles around the player from LakeMap, NPC icons,
    /// other players as dots. Anything outside the shown area is pinned to the edge with an arrow.
    /// "Başlangıca dön" sends GOTO_SPAWN; the server picks the tile (docs/protokol.md).
    /// </summary>
    public sealed class MiniMap
    {
        static readonly Color Grass = new Color32(0x5a, 0x8a, 0x4a, 0xff);
        static readonly Color Water = new Color32(0x4d, 0x9b, 0xe6, 0xff);
        static readonly Color Blocked = new Color32(0x37, 0x4e, 0x4a, 0xff);
        static readonly Color Player = new Color32(0xf2, 0xe8, 0xd0, 0xff);
        const float EdgeInset = 7f;

        readonly MiniMapView view;
        readonly Connection net;
        readonly Texture2D texture;
        readonly List<MiniMapMarker> pool = new List<MiniMapMarker>();
        float sentAt = -10f;

        public MiniMap(MiniMapView view, Connection net)
        {
            this.view = view;
            this.net = net;
            if (view == null) return;
            texture = new Texture2D(LakeMap.Width, LakeMap.Height, TextureFormat.RGBA32, false) { filterMode = FilterMode.Point, wrapMode = TextureWrapMode.Clamp };
            var pixels = new Color[LakeMap.Width * LakeMap.Height];
            for (var y = 0; y < LakeMap.Height; y++)
            for (var x = 0; x < LakeMap.Width; x++)
            {
                var p = new Vector2(x + 0.5f, y + 0.5f);
                var c = LakeMap.IsWater(p) ? Water : LakeMap.IsBlockedTile(x, y) ? Blocked : Grass;
                pixels[(LakeMap.Height - 1 - y) * LakeMap.Width + x] = c; // texture rows grow up, server y grows down
            }
            texture.SetPixels(pixels);
            texture.Apply();
            view.map.texture = texture;
            view.home.onClick.AddListener(GoHome);
        }

        public void Destroy()
        {
            if (texture != null) Object.Destroy(texture);
        }

        void GoHome()
        {
            sentAt = Time.time;
            net.Send(OpCode.GotoSpawn, new GotoSpawnMsg());
        }

        /// <summary>TELEPORT after "Başlangıca dön": true when it was ours (a refusal is shown here).</summary>
        public bool OnTeleport(TeleportMsg t)
        {
            if (Time.time - sentAt > 3f) return false;
            sentAt = -10f;
            if (!string.IsNullOrEmpty(t.reason))
                Toasts.Show(t.reason == "RATE_LIMITED" ? "Biraz bekle, sonra tekrar dene"
                    : t.reason == "BUSY" ? "Takastayken ışınlanamazsın"
                    : t.reason == "NO_SPOT" ? "Başlangıçta boş yer yok"
                    : $"Işınlanılamadı ({t.reason})", true);
            return true;
        }

        /// <summary>Call every frame with our position, the NPCs and the other players in view.</summary>
        public void Tick(Vector2 me, IEnumerable<(string kind, string name, Vector2 pos)> npcs, IEnumerable<Vector2> others, bool questsReady)
        {
            if (view == null) return;
            var size = view.area.rect.size;
            var tiles = size / view.unitsPerTile;
            // Window of tiles around us, kept inside the map when the map is bigger than the window.
            var left = Mathf.Clamp(me.x - tiles.x / 2f, 0f, Mathf.Max(0f, LakeMap.Width - tiles.x));
            var top = Mathf.Clamp(me.y - tiles.y / 2f, 0f, Mathf.Max(0f, LakeMap.Height - tiles.y));
            left = Mathf.Round(left * view.unitsPerTile) / view.unitsPerTile;
            top = Mathf.Round(top * view.unitsPerTile) / view.unitsPerTile;
            view.map.uvRect = new Rect(left / LakeMap.Width, 1f - (top + tiles.y) / LakeMap.Height, tiles.x / LakeMap.Width, tiles.y / LakeMap.Height);

            Vector2 Local(Vector2 p) => new Vector2((p.x - left) * view.unitsPerTile, -(p.y - top) * view.unitsPerTile);
            view.me.anchoredPosition = Snap(Local(me));

            var used = 0;
            foreach (var (kind, name, pos) in npcs)
            {
                var (colour, letter) = Look(kind, questsReady);
                Place(Marker(used++), Local(pos), size, colour, letter, 10f);
            }
            foreach (var p in others)
            {
                var local = Local(p);
                if (!Inside(local, size)) continue; // players only while in the shown area
                Place(Marker(used++), local, size, Player, "", 4f);
            }
            for (var i = used; i < pool.Count; i++)
                if (pool[i].gameObject.activeSelf) pool[i].gameObject.SetActive(false);
        }

        static (Color, string) Look(string kind, bool questsReady)
        {
            switch (kind)
            {
                case "merchant": return (new Color32(0xf9, 0xc2, 0x2b, 0xff), "T");
                case "crafter": return (new Color32(0xa8, 0x84, 0xf3, 0xff), "Z");
                case "quests": return (new Color32(0xe8, 0x3b, 0x3b, 0xff), questsReady ? "!" : "G");
                case "banker": return (new Color32(0x8f, 0xd3, 0xff, 0xff), "B");
                default: return (Color.white, "?");
            }
        }

        static bool Inside(Vector2 local, Vector2 size) => local.x >= 0f && local.x <= size.x && local.y <= 0f && local.y >= -size.y;

        MiniMapMarker Marker(int i)
        {
            while (pool.Count <= i)
            {
                var m = Object.Instantiate(view.markerTemplate, view.markers, false);
                m.name = "Marker";
                pool.Add(m);
            }
            var marker = pool[i];
            if (!marker.gameObject.activeSelf) marker.gameObject.SetActive(true);
            return marker;
        }

        /// <summary>Inside: at its place. Outside: pinned to the edge, the arrow pointing the way to it.</summary>
        static void Place(MiniMapMarker m, Vector2 local, Vector2 size, Color colour, string letter, float iconSize)
        {
            var inside = Inside(local, size);
            var at = local;
            if (!inside)
            {
                at.x = Mathf.Clamp(local.x, EdgeInset, size.x - EdgeInset);
                at.y = Mathf.Clamp(local.y, -size.y + EdgeInset, -EdgeInset);
            }
            m.rect.anchoredPosition = Snap(at);
            m.icon.color = colour;
            m.icon.rectTransform.sizeDelta = new Vector2(iconSize, iconSize);
            if (m.letter.text != letter) m.letter.text = letter;
            m.arrow.gameObject.SetActive(!inside);
            if (!inside)
            {
                var dir = (local - at).normalized;
                m.arrow.anchoredPosition = Snap(dir * 8f);
                m.arrow.localEulerAngles = new Vector3(0f, 0f, Mathf.Atan2(dir.y, dir.x) * Mathf.Rad2Deg);
            }
        }

        static Vector2 Snap(Vector2 v) => new Vector2(Mathf.Round(v.x), Mathf.Round(v.y));
    }
}
