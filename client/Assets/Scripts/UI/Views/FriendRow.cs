using UnityEngine;
using UnityEngine.UI;

namespace CollectionGame.UI.Views
{
    /// <summary>One player row of the friends window (arkadaslar-list / -requests). Made by UiPrefabBuilder.</summary>
    public sealed class FriendRow : MonoBehaviour
    {
        public Image back;
        public SlotView avatar;
        public Image dot;
        public Text name, sub;
        public Button go, chat, menu, no, yes, cancel, unblock;
    }
}
