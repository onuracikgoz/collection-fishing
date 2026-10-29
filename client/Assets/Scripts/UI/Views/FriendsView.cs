using UnityEngine;
using UnityEngine.UI;

namespace CollectionGame.UI.Views
{
    /// <summary>Friends window of drafts arkadaslar-list / arkadaslar-requests. Made by UiPrefabBuilder.</summary>
    public sealed class FriendsView : MonoBehaviour
    {
        public WindowView window;
        public Button[] tabs;
        public Text[] tabTexts;
        public GameObject requestBadge;
        public Text requestCount;
        public Sprite tabOn, tabOff, rowOnline, rowOffline;
        public Sprite dotOnline, dotOffline;
        public InputField search;
        public Button add;
        public RectTransform list;
        public Text sectionTemplate;
        public FriendRow rowTemplate;
        public Text empty;
        public Toggle friendsOnly;
    }
}
