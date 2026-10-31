using UnityEngine;
using UnityEngine.UI;

namespace CollectionGame.UI.Views
{
    /// <summary>
    /// Mini map at the top right of the HUD (31.10.2026, Onur): the map around the player, small icons
    /// for the NPCs and other players; what is off the map sits on its edge with an arrow pointing to it.
    /// "Başlangıca dön" under it. World/MiniMap fills it. Made by UiPrefabBuilder (part of Hud).
    /// </summary>
    public sealed class MiniMapView : MonoBehaviour
    {
        /// <summary>The visible map area (tiles are drawn into <see cref="map"/>'s texture).</summary>
        public RectTransform area;
        public RawImage map;
        public RectTransform markers;
        public MiniMapMarker markerTemplate;
        public RectTransform me;
        public Button home;
        public Text homeText;
        /// <summary>Layout units per map tile.</summary>
        public float unitsPerTile = 2f;
    }
}
