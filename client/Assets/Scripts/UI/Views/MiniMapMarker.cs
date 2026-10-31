using UnityEngine;
using UnityEngine.UI;

namespace CollectionGame.UI.Views
{
    /// <summary>One mini map icon: a coloured square with a letter; the arrow shows when it sits on the edge.</summary>
    public sealed class MiniMapMarker : MonoBehaviour
    {
        public RectTransform rect;
        public Image icon;
        public Text letter;
        public RectTransform arrow;
    }
}
