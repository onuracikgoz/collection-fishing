using UnityEngine;
using UnityEngine.UI;

namespace CollectionGame.UI.Views
{
    /// <summary>
    /// Notifications of drafts bildirim-yigin / bildirim-ust: the stack of up to 4 boxes at the top right,
    /// the rare-catch line at the top, and the level-up window. Made by UiPrefabBuilder; UI/Toasts.cs fills it.
    /// </summary>
    public sealed class NoticesView : MonoBehaviour
    {
        [System.Serializable]
        public sealed class Box
        {
            public RectTransform root;
            public Image icon, timer;
            public Text title, sub;
            public Button action;
            public Text actionText;
            public CardHover hover;
        }

        public Box[] boxes;
        public GameObject more;
        public Text moreText;

        public GameObject announce;
        public Text announceTitle, announceSub;

        public WindowView levelUp;
        public Text level;
        public GameObject[] unlocks;
        public Text[] unlockTitles, unlockSubs;
    }
}
