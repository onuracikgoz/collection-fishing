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
        public RectTransform chargeFill, chargeMarker;
        public Text chargeSub;
        public RectTransform bite;
        public RectTransform reel;
        public RectTransform water, bar, fish, progressFill;
        public RectTransform hint;
        public Text hintText;
    }
}
