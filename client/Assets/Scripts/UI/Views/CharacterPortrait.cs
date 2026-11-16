using CollectionGame.Net;
using CollectionGame.Wardrobe;
using UnityEngine;
using UnityEngine.UI;

namespace CollectionGame.UI.Views
{
    /// <summary>
    /// A player's character as it looks in the world now (the same Universal LPC layers as CharacterView,
    /// standing, facing down), cut to head and shoulders by the masked <see cref="holder"/>.
    /// Profile card portrait (31.10.2026, Onur). Made by UiPrefabBuilder.
    /// </summary>
    public sealed class CharacterPortrait : MonoBehaviour
    {
        const int Frame = 64;
        const int DownRow = 2;

        /// <summary>Masked box the 64x64 frame is drawn in (one art pixel = one kit pixel).</summary>
        public RectTransform holder;

        Image[] layers = new Image[0];
        string shown;

        /// <summary>Shows this look (null or empty user id clears it). Same layers as the world character, standing.</summary>
        public void Show(string userId, LookView look)
        {
            var key = string.IsNullOrEmpty(userId) ? null : userId + "|" + (look == null ? "" : JsonUtility.ToJson(look));
            if (shown == key) return;
            shown = key;
            foreach (var l in layers)
                if (l != null) Destroy(l.gameObject);
            layers = new Image[0];
            if (key == null || holder == null) return;
            var lpc = LpcLook.Layers(look);
            layers = new Image[lpc.Count];
            for (var i = 0; i < lpc.Count; i++)
            {
                var go = new GameObject("Layer" + i, typeof(RectTransform));
                go.layer = 5;
                var rt = (RectTransform)go.transform;
                rt.SetParent(holder, false);
                // 64x64 art pixels at two layout units each, head near the top of the box.
                rt.anchorMin = rt.anchorMax = rt.pivot = new Vector2(0.5f, 1f);
                rt.sizeDelta = new Vector2(Frame * 2, Frame * 2);
                rt.anchoredPosition = new Vector2(0f, 16f);
                var img = go.AddComponent<Image>();
                img.raycastTarget = false;
                img.sprite = LpcLook.Sprite(lpc[i], LpcLook.Anim.Idle, 0, DownRow, 0.5f);
                img.enabled = img.sprite != null;
                layers[i] = img;
            }
        }
    }
}
