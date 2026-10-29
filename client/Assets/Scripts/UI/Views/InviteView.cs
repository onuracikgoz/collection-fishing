using UnityEngine;
using UnityEngine.UI;

namespace CollectionGame.UI.Views
{
    /// <summary>Trade offer box of draft oyuncu-teklif. Made by UiPrefabBuilder.</summary>
    public sealed class InviteView : MonoBehaviour
    {
        public GameObject root;
        public Text title, sub, caption;
        public RectTransform timer;
        public Button accept, decline;
    }
}
