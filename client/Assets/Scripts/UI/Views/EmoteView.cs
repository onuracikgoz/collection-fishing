using UnityEngine;
using UnityEngine.UI;

namespace CollectionGame.UI.Views
{
    /// <summary>Emote window of draft emote-menu: worn status card, status emotes, gestures. Made by UiPrefabBuilder.</summary>
    public sealed class EmoteView : MonoBehaviour
    {
        public WindowView window;
        public SlotView current;
        public Text currentText;
        public Button remove;
        public SlotView[] status;
        public SlotView[] gestures;
    }
}
