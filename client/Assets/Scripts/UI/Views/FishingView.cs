using UnityEngine;
using UnityEngine.UI;

namespace CollectionGame.UI.Views
{
    /// <summary>
    /// Fishing moments next to the player (drafts balik-at, balik-vurus, balik-cekme): the cast meter,
    /// the bite mark, the reel panel and a short hint line. World/FishingHud.cs moves them with the
    /// player each frame. Made by UiPrefabBuilder.
    /// </summary>
    public sealed class FishingView : MonoBehaviour
    {
        public RectTransform charge;
        /// <summary>
        /// balik-at: two framed boxes (Kıyı + Orta, then Derin), a yellow fill in each and one white
        /// marker over the whole track. Charge 0..1 runs along <see cref="chargeTrack"/>.
        /// </summary>
        public RectTransform chargeTrack, chargeFill, chargeFillDeep, chargeMarker;
        public Text chargeSub;

        public void SetCharge(float c)
        {
            c = Mathf.Clamp01(c);
            chargeMarker.anchorMin = chargeMarker.anchorMax = new Vector2(c, 0.5f);
            var r = chargeTrack.rect;
            var x = chargeTrack.TransformPoint(new Vector3(Mathf.Lerp(r.xMin, r.xMax, c), 0f, 0f));
            FillTo(chargeFill, x);
            FillTo(chargeFillDeep, x);
        }

        /// <summary>Fills a box's inner area up to world point x.</summary>
        static void FillTo(RectTransform fill, Vector3 x)
        {
            var inner = (RectTransform)fill.parent;
            var local = inner.InverseTransformPoint(x).x;
            var r = inner.rect;
            HudView.Fill(fill, r.width > 0f ? (local - r.xMin) / r.width : 0f);
        }
        public RectTransform bite;
        public RectTransform reel;
        public RectTransform water, bar, fish, progressFill;
        public RectTransform hint;
        public Text hintText;
    }
}
