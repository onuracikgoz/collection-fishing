using CollectionGame.Art;
using CollectionGame.World;
using UnityEngine;
using UnityEngine.UI;

namespace CollectionGame.UI.Views
{
    /// <summary>
    /// A player's character as it looks in the world now (the same LPC layers as CharacterView,
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

        /// <summary>Shows the character of this player id; null or empty clears it.</summary>
        public void Show(string userId)
        {
            if (shown == userId) return;
            shown = userId;
            foreach (var l in layers)
                if (l != null) Destroy(l.gameObject);
            layers = new Image[0];
            if (string.IsNullOrEmpty(userId) || holder == null) return;
            var paths = Appearance.For(userId).LayerPaths;
            layers = new Image[paths.Length];
            var rect = new RectInt(0, DownRow * Frame, Frame, Frame);
            for (var i = 0; i < paths.Length; i++)
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
                img.sprite = ArtCatalog.Sprite(string.Format(paths[i], "Idle"), rect);
                img.enabled = img.sprite != null;
                layers[i] = img;
            }
        }
    }
}
