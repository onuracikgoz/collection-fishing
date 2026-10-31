using UnityEngine;
using UnityEngine.UI;

namespace CollectionGame.UI.Views
{
    /// <summary>Bag window of draft canta-v2: capacity, an 8-wide slot grid, a footer line. Made by UiPrefabBuilder.</summary>
    public sealed class BagView : MonoBehaviour
    {
        public WindowView window;
        public Text capacity;
        public Text balance;
        public RectTransform grid;
        public SlotView slotTemplate;
        public Text footer;
        /// <summary>Trash can: drop an item on it, confirm, the server throws it away (ITEM_DISCARD).</summary>
        public RectTransform trash;
        public Image trashHighlight;
    }
}
